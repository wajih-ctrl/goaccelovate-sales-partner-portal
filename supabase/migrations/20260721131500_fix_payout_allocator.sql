-- Avoid a PL/pgSQL record-variable/query-alias collision in payout allocation.

create or replace function public.request_commission_payout(
  commission_ids uuid[],
  requested_amount numeric,
  preferred_bank text,
  preferred_method text,
  liable_for_taxes boolean,
  message text default null
)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid := public.current_partner_id();
  request_row public.payout_requests;
  available_total numeric;
  remaining numeric;
  allocation_row record;
  allocation numeric;
begin
  if partner is null then raise exception 'Only linked Sales Partners can request payouts'; end if;
  if coalesce(cardinality(commission_ids),0)=0 then raise exception 'Select at least one commission'; end if;
  if requested_amount is null or requested_amount<=0 then raise exception 'Requested payout amount must be positive'; end if;
  if coalesce(trim(preferred_bank),'')='' then raise exception 'Preferred bank is required'; end if;
  if preferred_method not in ('Bank Transfer','ACH Transfer','Wire Transfer') then raise exception 'Select a supported payout method'; end if;
  if liable_for_taxes is null then raise exception 'Tax liability selection is required'; end if;
  if exists (
    select 1 from unnest(commission_ids) requested_commission(id)
    left join public.commissions commission on commission.id=requested_commission.id
    where commission.id is null or commission.partner_id<>partner
      or commission.state<>'Unpaid' or commission.eligible_amount-commission.paid_amount<=0
  ) then raise exception 'One or more commissions are not currently payable'; end if;
  select sum(eligible_amount-paid_amount) into available_total
  from public.commissions where id=any(commission_ids);
  if requested_amount>available_total then
    raise exception 'Requested amount exceeds the selected payable balance';
  end if;

  insert into public.payout_requests(
    partner_id,requested_by,amount,status,message,preferred_bank,preferred_payment_method,tax_liability
  ) values(
    partner,auth.uid(),requested_amount,'Pending',nullif(trim(message),''),
    trim(preferred_bank),preferred_method,liable_for_taxes
  ) returning * into request_row;

  remaining := requested_amount;
  for allocation_row in
    select commission.id, commission.eligible_amount-commission.paid_amount as available
    from unnest(commission_ids) with ordinality requested_commission(id, position)
    join public.commissions commission on commission.id=requested_commission.id
    order by requested_commission.position
  loop
    exit when remaining<=0;
    allocation := least(remaining,allocation_row.available);
    insert into public.payout_request_items(payout_request_id,commission_id,amount)
    values(request_row.id,allocation_row.id,allocation);
    update public.commissions set state='Payout Requested' where id=allocation_row.id;
    remaining := remaining-allocation;
  end loop;

  insert into public.notifications(recipient_id,title,body,type,mandatory)
  select id,'New payout request',
    'A Sales Partner requested a payout of ' || requested_amount || ' via ' || preferred_method || '.',
    'info',true
  from public.profiles
  where role='super_admin' and account_status='active' and id<>auth.uid();
  perform public.record_audit(
    'Payout Requested','Payouts',request_row.id::text,'Payout request',null,
    jsonb_build_object(
      'amount',requested_amount,
      'preferred_bank',trim(preferred_bank),
      'preferred_method',preferred_method,
      'tax_liability',liable_for_taxes
    )
  );
  return request_row;
end;
$$;

revoke all on function public.request_commission_payout(
  uuid[],numeric,text,text,boolean,text
) from public, anon;
grant execute on function public.request_commission_payout(
  uuid[],numeric,text,text,boolean,text
) to authenticated;
