-- Reconcile commission eligibility when Closed Won changes the confirmed deal value
-- after a final client payment has already been recorded.
create or replace function public.close_lead_won_secure(
  target_lead uuid,
  confirmed_deal_value numeric
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  row_before public.leads;
  row_after public.leads;
  partner_row public.partner_profiles;
  commission_row public.commissions;
  commission_amount numeric;
  release_amount numeric := 0;
  final_payment_logged boolean := false;
begin
  if not public.is_admin() then raise exception 'Only Admin or Super Admin can close a deal as won'; end if;
  if confirmed_deal_value is null or confirmed_deal_value <= 0 then
    raise exception 'Confirmed deal value must be positive';
  end if;

  select * into row_before from public.leads where id = target_lead for update;
  if row_before.id is null then raise exception 'Lead not found'; end if;
  select * into partner_row from public.partner_profiles where id = row_before.partner_id;
  if partner_row.id is null then raise exception 'Partner profile not found'; end if;
  commission_amount := round(confirmed_deal_value * partner_row.commission_rate / 100.0, 2);
  select exists (
    select 1 from public.client_payments
    where lead_id = target_lead and payment_type = 'Final'
  ) into final_payment_logged;

  select * into commission_row
  from public.commissions
  where lead_id = target_lead and kind = 'Deal'
  order by created_at
  limit 1
  for update;
  if commission_row.id is not null
     and commission_amount < greatest(commission_row.eligible_amount, commission_row.paid_amount) then
    raise exception 'Confirmed value cannot reduce commission below its released or paid amount';
  end if;

  update public.leads
  set stage = 'Closed Won', status = 'Closed Won', confirmed_value = confirmed_deal_value,
      last_activity_at = now(), updated_at = now()
  where id = target_lead
  returning * into row_after;

  if commission_row.id is null then
    release_amount := case when final_payment_logged then commission_amount else 0 end;
    insert into public.commissions (
      lead_id, partner_id, kind, rate, base_amount, amount, eligible_amount,
      state, closed_date, created_by
    ) values (
      target_lead, row_before.partner_id, 'Deal', partner_row.commission_rate,
      confirmed_deal_value, commission_amount, release_amount,
      case
        when final_payment_logged then 'Unpaid'::public.commission_state
        else 'On Hold'::public.commission_state
      end,
      current_date, auth.uid()
    );
  else
    release_amount := case
      when final_payment_logged then greatest(commission_amount - commission_row.eligible_amount, 0)
      else 0
    end;
    update public.commissions
    set rate = partner_row.commission_rate,
        base_amount = confirmed_deal_value,
        amount = commission_amount,
        eligible_amount = case
          when final_payment_logged then commission_amount
          else eligible_amount
        end,
        state = case
          when state in ('Payout Requested', 'Approved', 'Disputed') then state
          when final_payment_logged and paid_amount >= commission_amount
            then 'Paid'::public.commission_state
          when final_payment_logged then 'Unpaid'::public.commission_state
          else state
        end,
        closed_date = current_date,
        updated_at = now()
    where id = commission_row.id;
  end if;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
  select target_lead, 'stage_change', auth.uid(), coalesce(full_name, email::text),
    'Deal closed won with confirmed value ' || confirmed_deal_value
  from public.profiles where id = auth.uid();
  insert into public.notifications (partner_id, title, body, type, mandatory)
  values (
    row_before.partner_id, 'Deal closed won',
    row_before.company_name || ' closed won. Your commission is released as client payments are recorded.',
    'success', true
  );
  if release_amount > 0 then
    insert into public.notifications (partner_id, title, body, type, mandatory)
    values (
      row_before.partner_id, 'Final commission now payable',
      row_before.company_name || ': ' || release_amount || ' in recalculated commission is now available for payout.',
      'success', true
    );
  end if;
  perform public.record_audit(
    'Deal Closed Won', 'Leads', target_lead::text, row_before.company_name,
    jsonb_build_object('stage', row_before.stage, 'confirmed_value', row_before.confirmed_value),
    jsonb_build_object(
      'stage', 'Closed Won', 'confirmed_value', confirmed_deal_value,
      'commission', commission_amount, 'commission_released', release_amount
    )
  );
  return row_after;
end;
$$;

revoke all on function public.close_lead_won_secure(uuid, numeric) from public, anon;
grant execute on function public.close_lead_won_secure(uuid, numeric) to authenticated;
