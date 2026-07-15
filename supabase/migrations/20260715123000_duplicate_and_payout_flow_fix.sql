-- Reject duplicates without creating lead records and require a confirmed amount
-- when an approved payout is recorded as paid.

drop function if exists public.submit_partner_lead(
  uuid, text, text, text, text, text, text, text, text, numeric, text, text
);

create function public.submit_partner_lead(
  lead_id uuid,
  company_name text,
  contact_name text,
  contact_title text,
  contact_email text,
  contact_phone text,
  client_linkedin text,
  country text,
  industry text,
  estimated_value numeric,
  currency text,
  description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid := public.current_partner_id();
  inserted public.leads;
  email_duplicate boolean := false;
  phone_duplicate boolean := false;
  normalized_phone text := regexp_replace(coalesce(contact_phone, ''), '[^0-9]+', '', 'g');
  duplicate_reason text;
  first_lead_step uuid;
  supported_currencies jsonb;
begin
  if partner is null then raise exception 'Only linked Sales Partners can submit leads'; end if;
  if not public.partner_agreements_complete(partner) then
    raise exception 'Sign the current Agreement and NDA before submitting leads';
  end if;
  if coalesce(trim(company_name), '') = '' then raise exception 'Company name is required'; end if;
  if coalesce(trim(contact_name), '') = '' then raise exception 'Contact name is required'; end if;
  if coalesce(trim(contact_title), '') = '' then raise exception 'Job title is required'; end if;
  if coalesce(trim(contact_email), '') = '' then raise exception 'Email is required'; end if;
  if contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email format';
  end if;
  if coalesce(trim(country), '') = '' then raise exception 'Country is required'; end if;
  if coalesce(trim(industry), '') = '' then raise exception 'Industry is required'; end if;
  if estimated_value is null or estimated_value <= 0 then
    raise exception 'Value must be a positive number';
  end if;
  if char_length(trim(description)) < 50 then
    raise exception 'Message must contain at least 50 characters';
  end if;
  if array_length(regexp_split_to_array(trim(description), '\s+'), 1) > 1000 then
    raise exception 'Maximum 1,000 words allowed';
  end if;

  select value into supported_currencies from public.settings where key = 'supported_currencies';
  if supported_currencies is not null and not (supported_currencies ? currency) then
    raise exception 'Unsupported currency';
  end if;

  select exists (
    select 1 from public.leads lead
    where lower(lead.contact_email::text) = lower(trim(submit_partner_lead.contact_email))
  ) into email_duplicate;

  if normalized_phone <> '' then
    select exists (
      select 1 from public.leads lead
      where regexp_replace(coalesce(lead.contact_phone, ''), '[^0-9]+', '', 'g') = normalized_phone
    ) into phone_duplicate;
  end if;

  if email_duplicate or phone_duplicate then
    duplicate_reason := case
      when email_duplicate and phone_duplicate then 'This contact email and phone number already exist.'
      when email_duplicate then 'This contact email already exists.'
      else 'This contact phone number already exists.'
    end;

    insert into public.notifications (recipient_id, title, body, type, mandatory)
    select profile.id,
      'Duplicate lead blocked',
      trim(company_name) || ' was rejected before entering the pipeline. ' || duplicate_reason,
      'warning',
      false
    from public.profiles profile
    where profile.role in ('admin', 'super_admin') and profile.account_status = 'active';

    insert into public.notifications (recipient_id, partner_id, title, body, type, mandatory)
    values (
      auth.uid(), partner, 'Duplicate lead rejected',
      duplicate_reason || ' No lead record was created.', 'warning', true
    );

    perform public.record_audit(
      'Duplicate Lead Blocked', 'Leads', null, trim(company_name), null,
      jsonb_build_object('reason', duplicate_reason, 'record_created', false)
    );

    return jsonb_build_object(
      'accepted', false,
      'duplicate', true,
      'reason', duplicate_reason
    );
  end if;

  insert into public.leads (
    id, partner_id, company_name, contact_name, contact_title, contact_email, contact_phone,
    client_linkedin, country, industry, estimated_value, currency, description, stage, status,
    created_by
  ) values (
    lead_id, partner, trim(company_name), trim(contact_name), trim(contact_title),
    lower(trim(contact_email)), nullif(trim(contact_phone), ''), nullif(trim(client_linkedin), ''),
    trim(country), trim(industry), estimated_value, trim(currency), trim(description),
    'Identified Opportunity', 'Open', auth.uid()
  ) returning * into inserted;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
  values (
    inserted.id, 'system', auth.uid(), 'System',
    'Lead accepted automatically into Identified Opportunity'
  );

  insert into public.notifications (recipient_id, title, body, type, mandatory)
  select profile.id, 'New lead submitted', inserted.company_name || ' entered the pipeline.',
    'info', false
  from public.profiles profile
  where profile.role in ('admin', 'super_admin') and profile.account_status = 'active';

  insert into public.notifications (recipient_id, partner_id, title, body, type, mandatory)
  values (
    auth.uid(), partner, 'Lead accepted into pipeline',
    inserted.company_name || ' entered Identified Opportunity.', 'success', false
  );

  select id into first_lead_step from public.onboarding_steps where key = 'firstLead' limit 1;
  if first_lead_step is not null then
    insert into public.partner_onboarding_steps (
      partner_id, step_id, completed, completed_at, completed_by
    ) values (partner, first_lead_step, true, now(), auth.uid())
    on conflict (partner_id, step_id)
    do update set completed = true, completed_at = now(), completed_by = auth.uid();
  end if;

  perform public.record_audit(
    'Lead Submitted', 'Leads', inserted.id::text, inserted.company_name, null, to_jsonb(inserted)
  );

  return jsonb_build_object('accepted', true, 'duplicate', false, 'lead', to_jsonb(inserted));
end;
$$;

revoke all on function public.submit_partner_lead(
  uuid, text, text, text, text, text, text, text, text, numeric, text, text
) from public, anon;
grant execute on function public.submit_partner_lead(
  uuid, text, text, text, text, text, text, text, text, numeric, text, text
) to authenticated;

-- These rows were created by the former duplicate implementation and should not
-- remain as pipeline records. Related activity and attachments cascade.
delete from public.leads where status::text = 'Duplicate Rejected';

drop function if exists public.record_payout_paid(uuid, date, text, text);

create function public.record_payout_paid(
  target_payout uuid,
  payment_amount numeric,
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
  if payment_amount is null or payment_amount <= 0 then raise exception 'Payment amount is required'; end if;
  if paid_on is null then raise exception 'Payment date is required'; end if;
  if coalesce(trim(method), '') = '' then raise exception 'Payment method is required'; end if;
  if coalesce(trim(reference), '') = '' then raise exception 'Transaction reference is required'; end if;

  select * into row_before
  from public.payout_requests
  where id = target_payout
  for update;

  if row_before.id is null or row_before.status <> 'Approved' then
    raise exception 'Approved payout not found';
  end if;
  if abs(payment_amount - row_before.amount) > 0.005 then
    raise exception 'Payment amount must match the approved payout amount';
  end if;

  update public.payout_requests
  set status = 'Paid',
      paid_amount = payment_amount,
      paid_date = paid_on,
      payment_method = trim(method),
      transaction_reference = trim(reference),
      updated_at = now()
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
    row_after.partner_id,
    'Payout confirmed',
    'Your payout of ' || payment_amount || ' was paid via ' || trim(method) ||
      '. Transaction reference: ' || trim(reference) || '.',
    'success',
    true
  );

  perform public.record_audit(
    'Payout Paid', 'Payouts', target_payout::text, 'External payout confirmed',
    to_jsonb(row_before), to_jsonb(row_after)
  );
  return row_after;
end;
$$;

revoke all on function public.record_payout_paid(uuid, numeric, date, text, text) from public, anon;
grant execute on function public.record_payout_paid(uuid, numeric, date, text, text) to authenticated;
