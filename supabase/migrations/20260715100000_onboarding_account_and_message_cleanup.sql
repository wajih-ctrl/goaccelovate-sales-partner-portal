alter table public.partner_profiles
  add column if not exists deleted_at timestamptz;

create index if not exists partner_profiles_active_idx
  on public.partner_profiles (name)
  where deleted_at is null;

update public.onboarding_steps
set active = false
where key in ('enablement', 'activation');

delete from public.partner_onboarding_steps
where step_id in (
  select id
  from public.onboarding_steps
  where key in ('enablement', 'activation')
);

update public.partner_profiles
set deleted_at = coalesce(deleted_at, updated_at, now()),
    user_id = null
where status = 'deactivated';

delete from public.partner_profiles p
where p.deleted_at is not null
  and not exists (select 1 from public.leads l where l.partner_id = p.id)
  and not exists (select 1 from public.commissions c where c.partner_id = p.id)
  and not exists (select 1 from public.payout_requests r where r.partner_id = p.id)
  and not exists (select 1 from public.disputes d where d.partner_id = p.id);

create or replace function public.request_commission_payout(
  commission_ids uuid[],
  message text default null
)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid := public.current_partner_id();
  partner_name text;
  request_row public.payout_requests;
  total numeric;
begin
  if partner is null then
    raise exception 'Only linked Sales Partners can request payouts';
  end if;
  if coalesce(cardinality(commission_ids), 0) = 0 then
    raise exception 'Select at least one commission';
  end if;
  if exists (
    select 1
    from unnest(commission_ids) as selected(id)
    left join public.commissions c on c.id = selected.id
    where c.id is null or c.partner_id <> partner
  ) then
    raise exception 'Commission access denied';
  end if;
  if exists (
    select 1
    from public.commissions c
    where c.id = any(commission_ids)
      and (c.state <> 'Unpaid' or c.eligible_amount - c.paid_amount <= 0)
  ) then
    raise exception 'One or more commissions are not currently payable';
  end if;

  select name into partner_name
  from public.partner_profiles
  where id = partner and deleted_at is null;
  if partner_name is null then
    raise exception 'Sales Partner account is not active';
  end if;

  select sum(eligible_amount - paid_amount)
  into total
  from public.commissions
  where id = any(commission_ids);

  insert into public.payout_requests(partner_id, requested_by, amount, status, message)
  values(partner, auth.uid(), total, 'Pending', nullif(trim(message), ''))
  returning * into request_row;

  insert into public.payout_request_items(payout_request_id, commission_id, amount)
  select request_row.id, id, eligible_amount - paid_amount
  from public.commissions
  where id = any(commission_ids);

  update public.commissions
  set state = 'Payout Requested'
  where id = any(commission_ids);

  insert into public.notifications(recipient_id, title, body, type, mandatory)
  select id,
         'New payout request',
         partner_name || ' submitted a payout request totaling ' || total::text || '.',
         'info',
         true
  from public.profiles
  where role in ('admin','super_admin') and account_status = 'active';

  perform public.record_audit(
    'Payout Requested',
    'Payouts',
    request_row.id::text,
    'Payout request for ' || partner_name,
    null,
    jsonb_build_object(
      'partner', partner_name,
      'amount', total,
      'commission_count', cardinality(commission_ids),
      'message', nullif(trim(message), '')
    )
  );
  return request_row;
end;
$$;

grant execute on function public.request_commission_payout(uuid[], text) to authenticated;
