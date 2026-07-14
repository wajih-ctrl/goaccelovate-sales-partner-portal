-- Enforce the approved pipeline, payment, commission, and payout workflow in the database.

create or replace function public.update_lead_stage_secure(
  target_lead uuid,
  target_stage public.lead_stage,
  change_reason text default null
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.app_role := public.current_user_role();
  row_before public.leads;
  row_after public.leads;
  partner_stages text[] := array[
    'Identified Opportunity', 'Outreach Started', 'In Communication', 'Discovery Call'
  ];
begin
  select * into row_before from public.leads where id = target_lead for update;
  if row_before.id is null then raise exception 'Lead not found'; end if;
  if row_before.stage = target_stage then raise exception 'Lead is already in that stage'; end if;

  if actor_role = 'partner' then
    if not public.is_current_partner(row_before.partner_id) then raise exception 'Lead access denied'; end if;
    if row_before.status = 'Duplicate Rejected' then
      raise exception 'Rejected duplicate leads cannot enter the pipeline';
    end if;
    if row_before.stage::text in ('Closed Won', 'Closed Lost') then
      raise exception 'Closed leads cannot be moved by Sales Partners';
    end if;

    if row_before.stage::text = 'On Hold' then
      if row_before.previous_stage is null or target_stage <> row_before.previous_stage then
        raise exception 'An On Hold lead must resume to its previous stage';
      end if;
      if not (row_before.previous_stage::text = any(partner_stages)) then
        raise exception 'Only Admin or Super Admin can resume this lead';
      end if;
    elsif target_stage::text not in ('On Hold', 'Closed Lost') then
      if not (row_before.stage::text = any(partner_stages))
         or not (target_stage::text = any(partner_stages)) then
        raise exception 'Sales Partners can move leads only within partner-controlled stages';
      end if;
    end if;
  elsif actor_role in ('admin', 'super_admin') then
    if row_before.stage::text = 'On Hold'
       and (row_before.previous_stage is null or target_stage <> row_before.previous_stage) then
      raise exception 'An On Hold lead must resume to its previous stage';
    end if;
  else
    raise exception 'Lead stage access denied';
  end if;

  if target_stage::text = 'Closed Lost' and coalesce(trim(change_reason), '') = '' then
    raise exception 'A Closed Lost reason is required';
  end if;
  if target_stage::text = 'Closed Won' and row_before.confirmed_value is null then
    raise exception 'Closed Won requires a confirmed deal value';
  end if;

  update public.leads
  set previous_stage = case
        when target_stage::text = 'On Hold' and stage::text <> 'On Hold' then stage
        else previous_stage
      end,
      stage = target_stage,
      status = case
        when target_stage::text = 'Closed Won' then 'Closed Won'::public.lead_status
        when target_stage::text = 'Closed Lost' then 'Closed Lost'::public.lead_status
        else 'Open'::public.lead_status
      end,
      closed_reason = case
        when target_stage::text = 'Closed Lost' then trim(change_reason)
        else closed_reason
      end,
      last_activity_at = now(),
      updated_at = now()
  where id = target_lead
  returning * into row_after;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
  select target_lead, 'stage_change', auth.uid(), coalesce(full_name, email::text),
    'Stage changed: ' || row_before.stage::text || ' -> ' || target_stage::text ||
      case when change_reason is null then '' else '. Reason: ' || trim(change_reason) end
  from public.profiles where id = auth.uid();

  insert into public.notifications (partner_id, title, body, type, mandatory)
  values (
    row_before.partner_id,
    'Lead stage updated',
    row_before.company_name || ' moved from ' || row_before.stage::text || ' to ' || target_stage::text || '.',
    case when target_stage::text = 'Closed Lost' then 'warning' else 'info' end,
    target_stage::text in ('Closed Won', 'Closed Lost')
  );

  perform public.record_audit(
    'Stage Change', 'Leads', target_lead::text, row_before.company_name,
    jsonb_build_object('stage', row_before.stage),
    jsonb_build_object('stage', target_stage, 'reason', change_reason)
  );
  return row_after;
end;
$$;

revoke all on function public.update_lead_stage_secure(uuid, public.lead_stage, text) from public, anon;
grant execute on function public.update_lead_stage_secure(uuid, public.lead_stage, text) to authenticated;

create or replace function public.update_lead_commercial_value_secure(
  target_lead uuid,
  new_value numeric
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  row_before public.leads;
  row_after public.leads;
  effective_stage text;
begin
  if not public.is_admin() then raise exception 'Only Admin or Super Admin can edit commercial value'; end if;
  if new_value is null or new_value <= 0 then raise exception 'Commercial value must be positive'; end if;

  select * into row_before from public.leads where id = target_lead for update;
  if row_before.id is null then raise exception 'Lead not found'; end if;
  effective_stage := case
    when row_before.stage::text = 'On Hold' then row_before.previous_stage::text
    else row_before.stage::text
  end;
  if effective_stage is null or effective_stage not in (
    'Contract Sent', 'Advance Pending', 'Advance Confirmed', 'Sent to Product',
    'Done by Product', 'Client Review', 'Under Revisions', 'Final Payment Clearance',
    'Final Handoff', 'Closed Won'
  ) then
    raise exception 'Commercial value can be edited from Contract Sent onward';
  end if;

  update public.leads
  set estimated_value = new_value, last_activity_at = now(), updated_at = now()
  where id = target_lead
  returning * into row_after;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
  select target_lead, 'partner_update', auth.uid(), coalesce(full_name, email::text),
    'Commercial value updated from ' || row_before.estimated_value || ' to ' || new_value
  from public.profiles where id = auth.uid();
  perform public.record_audit(
    'Estimated Value Updated', 'Leads', target_lead::text, row_before.company_name,
    jsonb_build_object('estimated_value', row_before.estimated_value),
    jsonb_build_object('estimated_value', new_value)
  );
  return row_after;
end;
$$;

revoke all on function public.update_lead_commercial_value_secure(uuid, numeric) from public, anon;
grant execute on function public.update_lead_commercial_value_secure(uuid, numeric) to authenticated;

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
    insert into public.commissions (
      lead_id, partner_id, kind, rate, base_amount, amount, state, closed_date, created_by
    ) values (
      target_lead, row_before.partner_id, 'Deal', partner_row.commission_rate,
      confirmed_deal_value, commission_amount, 'On Hold', current_date, auth.uid()
    );
  else
    update public.commissions
    set rate = partner_row.commission_rate,
        base_amount = confirmed_deal_value,
        amount = commission_amount,
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
  perform public.record_audit(
    'Deal Closed Won', 'Leads', target_lead::text, row_before.company_name,
    jsonb_build_object('stage', row_before.stage, 'confirmed_value', row_before.confirmed_value),
    jsonb_build_object('stage', 'Closed Won', 'confirmed_value', confirmed_deal_value, 'commission', commission_amount)
  );
  return row_after;
end;
$$;

revoke all on function public.close_lead_won_secure(uuid, numeric) from public, anon;
grant execute on function public.close_lead_won_secure(uuid, numeric) to authenticated;

create or replace function public.record_client_payment_and_eligibility(
  target_lead uuid,
  payment_amount numeric,
  payment_date date,
  payment_reference text,
  payment_method text,
  payment_type text,
  payment_notes text default null
)
returns public.client_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_row public.leads;
  payment_row public.client_payments;
  commission_row public.commissions;
  release_amount numeric := 0;
begin
  if not public.is_admin() then raise exception 'Only Admin users can record client payments'; end if;
  if payment_type not in ('Advance', 'Final') then raise exception 'Payment type must be Advance or Final'; end if;
  if payment_amount is null or payment_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  if payment_date is null then raise exception 'Payment date is required'; end if;
  if coalesce(trim(payment_reference), '') = '' then raise exception 'Payment reference is required'; end if;
  if coalesce(trim(payment_method), '') = '' then raise exception 'Payment method is required'; end if;

  select * into lead_row from public.leads where id = target_lead for update;
  if lead_row.id is null then raise exception 'Lead not found'; end if;
  if payment_type = 'Advance' and lead_row.stage::text not in (
    'Advance Confirmed', 'Sent to Product', 'Done by Product', 'Client Review',
    'Under Revisions', 'Final Payment Clearance', 'Final Handoff', 'Closed Won'
  ) then
    raise exception 'Advance payments can only be recorded from Advance Confirmed onward';
  end if;
  if payment_type = 'Final' and lead_row.stage::text not in (
    'Final Payment Clearance', 'Final Handoff', 'Closed Won'
  ) then
    raise exception 'Final payments can only be recorded from Final Payment Clearance onward';
  end if;

  insert into public.client_payments (
    lead_id, amount_received, received_date, payment_method, payment_reference, notes,
    trigger_commission_eligibility, payment_type, created_by
  ) values (
    target_lead, payment_amount, payment_date, trim(payment_method), trim(payment_reference),
    nullif(trim(payment_notes), ''), true, payment_type, auth.uid()
  ) returning * into payment_row;

  if not exists (select 1 from public.commissions where lead_id = target_lead and kind = 'Deal') then
    insert into public.commissions (
      lead_id, partner_id, kind, rate, base_amount, amount, state, created_by
    )
    select lead_row.id, lead_row.partner_id, 'Deal', profile.commission_rate,
      coalesce(lead_row.confirmed_value, lead_row.estimated_value),
      round(coalesce(lead_row.confirmed_value, lead_row.estimated_value) * profile.commission_rate / 100.0, 2),
      'On Hold', auth.uid()
    from public.partner_profiles profile where profile.id = lead_row.partner_id;
  end if;

  select * into commission_row
  from public.commissions
  where lead_id = target_lead and kind = 'Deal'
  order by created_at
  limit 1
  for update;

  if commission_row.id is not null then
    release_amount := case
      when payment_type = 'Final' then commission_row.amount - commission_row.eligible_amount
      else least(
        commission_row.amount - commission_row.eligible_amount,
        round(payment_amount * commission_row.rate / 100.0, 2)
      )
    end;
    release_amount := greatest(release_amount, 0);
    if release_amount > 0 then
      update public.commissions
      set eligible_amount = eligible_amount + release_amount,
          state = case
            when state in ('Payout Requested', 'Approved', 'Disputed') then state
            when paid_amount >= eligible_amount + release_amount then 'Paid'::public.commission_state
            else 'Unpaid'::public.commission_state
          end,
          updated_at = now()
      where id = commission_row.id;
      insert into public.notifications (partner_id, title, body, type, mandatory)
      values (
        lead_row.partner_id,
        case when payment_type = 'Advance' then 'Advance commission now payable' else 'Final commission now payable' end,
        lead_row.company_name || ': ' || release_amount || ' in commission is now available for payout.',
        'success', true
      );
    end if;
  end if;

  perform public.record_audit(
    'Client Payment Recorded', 'Client Payments', payment_row.id::text, lead_row.company_name,
    null,
    jsonb_build_object(
      'type', payment_type, 'amount', payment_amount, 'reference', trim(payment_reference),
      'commission_released', release_amount
    )
  );
  return payment_row;
end;
$$;

revoke all on function public.record_client_payment_and_eligibility(uuid, numeric, date, text, text, text, text) from public, anon;
grant execute on function public.record_client_payment_and_eligibility(uuid, numeric, date, text, text, text, text) to authenticated;

create or replace function public.review_payout_request(
  target_payout uuid,
  approve_request boolean,
  rejection_reason text default null
)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  row_before public.payout_requests;
  row_after public.payout_requests;
begin
  if not public.is_admin() then raise exception 'Only Admin or Super Admin can review payouts'; end if;
  select * into row_before from public.payout_requests where id = target_payout for update;
  if row_before.id is null then raise exception 'Payout request not found'; end if;
  if row_before.status <> 'Pending' then raise exception 'Only pending payout requests can be reviewed'; end if;
  if not approve_request and coalesce(trim(rejection_reason), '') = '' then
    raise exception 'A rejection reason is required';
  end if;

  update public.payout_requests
  set status = case when approve_request then 'Approved' else 'Rejected' end,
      approved_by = case when approve_request then auth.uid() else null end,
      approved_at = case when approve_request then now() else null end,
      reject_reason = case when approve_request then null else trim(rejection_reason) end,
      updated_at = now()
  where id = target_payout
  returning * into row_after;

  update public.commissions commission
  set state = case
        when approve_request then 'Approved'::public.commission_state
        else 'Unpaid'::public.commission_state
      end,
      updated_at = now()
  from public.payout_request_items item
  where item.payout_request_id = target_payout and item.commission_id = commission.id;

  insert into public.notifications (partner_id, title, body, type, mandatory)
  values (
    row_before.partner_id,
    case when approve_request then 'Payout approved' else 'Payout rejected' end,
    case
      when approve_request then 'Your payout request for ' || row_before.amount || ' was approved and is awaiting external payment.'
      else 'Your payout request for ' || row_before.amount || ' was rejected. Reason: ' || trim(rejection_reason)
    end,
    case when approve_request then 'success' else 'warning' end,
    true
  );
  perform public.record_audit(
    case when approve_request then 'Payout Approved' else 'Payout Rejected' end,
    'Payouts', target_payout::text, 'Payout request',
    to_jsonb(row_before), to_jsonb(row_after)
  );
  return row_after;
end;
$$;

revoke all on function public.review_payout_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_payout_request(uuid, boolean, text) to authenticated;

create or replace function public.record_payout_paid(
  target_payout uuid,
  paid_on date,
  method text,
  reference text
)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  row_before public.payout_requests;
  row_after public.payout_requests;
begin
  if not public.is_admin() then raise exception 'Only Admin users can record payouts'; end if;
  if paid_on is null then raise exception 'Payment date is required'; end if;
  if coalesce(trim(method), '') = '' then raise exception 'Payment method is required'; end if;
  if coalesce(trim(reference), '') = '' then raise exception 'Transaction reference is required'; end if;

  select * into row_before from public.payout_requests where id = target_payout for update;
  if row_before.id is null or row_before.status <> 'Approved' then
    raise exception 'Approved payout not found';
  end if;
  update public.payout_requests
  set status = 'Paid', paid_amount = amount, paid_date = paid_on,
      payment_method = trim(method), transaction_reference = trim(reference), updated_at = now()
  where id = target_payout
  returning * into row_after;

  update public.commissions commission
  set paid_amount = least(commission.amount, commission.paid_amount + item.amount),
      state = case
        when least(commission.amount, commission.paid_amount + item.amount) >= commission.amount
          then 'Paid'::public.commission_state
        else 'Unpaid'::public.commission_state
      end,
      updated_at = now()
  from public.payout_request_items item
  where item.payout_request_id = target_payout and item.commission_id = commission.id;

  insert into public.notifications (partner_id, title, body, type, mandatory)
  values (
    row_after.partner_id, 'Payout confirmed',
    'Your payout of ' || row_after.amount || ' was paid via ' || trim(method) || '. Reference: ' || trim(reference) || '.',
    'success', true
  );
  perform public.record_audit(
    'Payout Paid', 'Payouts', target_payout::text, 'Payout request',
    to_jsonb(row_before), to_jsonb(row_after)
  );
  return row_after;
end;
$$;

revoke all on function public.record_payout_paid(uuid, date, text, text) from public, anon;
grant execute on function public.record_payout_paid(uuid, date, text, text) to authenticated;

-- All payout state changes now go through the audited security-definer functions above.
revoke insert, update, delete on public.payout_requests from authenticated;
revoke insert, update, delete on public.payout_request_items from authenticated;
