create unique index if not exists partner_onboarding_unique_step
  on public.partner_onboarding_steps(partner_id, step_id);

create or replace function public.submit_partner_lead(
  lead_id uuid,
  company_name text,
  contact_name text,
  contact_title text,
  contact_email text,
  contact_phone text,
  country text,
  industry text,
  estimated_value numeric,
  currency text,
  description text
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid;
  inserted public.leads;
  duplicate_found boolean;
  first_lead_step uuid;
  supported_currencies jsonb;
begin
  partner := public.current_partner_id();
  if partner is null then
    raise exception 'Only linked partner users can submit leads';
  end if;

  if coalesce(trim(company_name), '') = '' then raise exception 'Company name is required'; end if;
  if coalesce(trim(contact_name), '') = '' then raise exception 'Contact name is required'; end if;
  if coalesce(trim(contact_title), '') = '' then raise exception 'Job title is required'; end if;
  if coalesce(trim(contact_email), '') = '' then raise exception 'Email is required'; end if;
  if contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email format'; end if;
  if coalesce(trim(country), '') = '' then raise exception 'Country is required'; end if;
  if coalesce(trim(industry), '') = '' then raise exception 'Industry is required'; end if;
  if estimated_value is null or estimated_value <= 0 then raise exception 'Value must be a positive number'; end if;
  if coalesce(trim(description), '') = '' then raise exception 'Description is required'; end if;
  if char_length(trim(description)) < 50 then raise exception 'Minimum 50 characters required'; end if;
  if array_length(regexp_split_to_array(trim(description), '\s+'), 1) > 500 then raise exception 'Maximum 500 words allowed'; end if;

  select value into supported_currencies
  from public.settings
  where key = 'supported_currencies';

  if supported_currencies is not null and not (supported_currencies ? currency) then
    raise exception 'Unsupported currency';
  end if;

  select exists (
    select 1
    from public.leads l
    where lower(l.contact_email::text) = lower(trim(submit_partner_lead.contact_email))
       or lower(l.company_name) = lower(trim(submit_partner_lead.company_name))
  ) into duplicate_found;

  insert into public.leads (
    id,
    partner_id,
    company_name,
    contact_name,
    contact_title,
    contact_email,
    contact_phone,
    country,
    industry,
    estimated_value,
    currency,
    description,
    stage,
    status,
    created_by
  )
  values (
    lead_id,
    partner,
    trim(company_name),
    trim(contact_name),
    trim(contact_title),
    lower(trim(contact_email)),
    nullif(trim(contact_phone), ''),
    trim(country),
    trim(industry),
    estimated_value,
    trim(currency),
    trim(description),
    'New Lead',
    case when duplicate_found then 'Duplicate Under Review'::public.lead_status else 'Active'::public.lead_status end,
    auth.uid()
  )
  returning * into inserted;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
  select inserted.id, 'system', auth.uid(), coalesce(p.full_name, 'Partner'), 'Lead submitted: ' || inserted.company_name
  from public.profiles p
  where p.id = auth.uid();

  if duplicate_found then
    insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
    values (inserted.id, 'system', auth.uid(), 'System', 'Potential duplicate detected by company name or contact email');
  end if;

  insert into public.notifications (recipient_id, title, body, type, mandatory)
  select p.id,
    case when duplicate_found then 'Duplicate lead requires review' else 'New lead submitted' end,
    inserted.company_name || ' submitted by ' || coalesce(actor.full_name, actor.email),
    case when duplicate_found then 'warning' else 'info' end,
    duplicate_found
  from public.profiles p
  cross join public.profiles actor
  where p.role in ('admin', 'super_admin')
    and actor.id = auth.uid();

  insert into public.notifications (recipient_id, partner_id, title, body, type, mandatory)
  values (
    auth.uid(),
    partner,
    case when duplicate_found then 'Lead sent for duplicate review' else 'Lead accepted into pipeline' end,
    inserted.company_name,
    case when duplicate_found then 'warning' else 'success' end,
    duplicate_found
  );

  select id into first_lead_step
  from public.onboarding_steps
  where key = 'firstLead'
  limit 1;

  if first_lead_step is not null and not duplicate_found then
    insert into public.partner_onboarding_steps (partner_id, step_id, completed, completed_at, completed_by)
    values (partner, first_lead_step, true, now(), auth.uid())
    on conflict (partner_id, step_id)
    do update set completed = true, completed_at = now(), completed_by = auth.uid();
  end if;

  perform public.record_audit(
    case when duplicate_found then 'Lead Submitted - Duplicate Review' else 'Lead Submitted' end,
    'Leads',
    inserted.id::text,
    inserted.company_name,
    null,
    to_jsonb(inserted)
  );

  return inserted;
end;
$$;

grant execute on function public.submit_partner_lead(uuid, text, text, text, text, text, text, text, numeric, text, text) to authenticated;

create or replace function public.open_commission_dispute(
  commission_id uuid,
  reason text
)
returns public.disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  commission_row public.commissions;
  inserted public.disputes;
begin
  if coalesce(trim(reason), '') = '' then
    raise exception 'Dispute reason is required';
  end if;

  select * into commission_row
  from public.commissions
  where id = commission_id
    and partner_id = public.current_partner_id();

  if commission_row.id is null then
    raise exception 'Commission not found';
  end if;

  if commission_row.state in ('Paid', 'Waived') then
    raise exception 'This commission cannot be disputed';
  end if;

  insert into public.disputes (commission_id, partner_id, opened_by, reason, status)
  values (commission_id, commission_row.partner_id, auth.uid(), trim(reason), 'Open')
  returning * into inserted;

  insert into public.dispute_messages (dispute_id, actor_id, actor_name, text)
  select inserted.id, auth.uid(), coalesce(p.full_name, p.email), trim(reason)
  from public.profiles p
  where p.id = auth.uid();

  update public.commissions
  set state = 'Disputed'
  where id = commission_id;

  insert into public.notifications (recipient_id, title, body, type, mandatory)
  select p.id, 'Commission dispute opened', commission_id::text || ': ' || trim(reason), 'warning', true
  from public.profiles p
  where p.role in ('admin', 'super_admin');

  perform public.record_audit(
    'Dispute Opened',
    'Commissions',
    commission_id::text,
    inserted.id::text,
    null,
    jsonb_build_object('reason', trim(reason))
  );

  return inserted;
end;
$$;

grant execute on function public.open_commission_dispute(uuid, text) to authenticated;

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
  partner uuid;
  total numeric(14,2);
  request_row public.payout_requests;
  invalid_count integer;
begin
  partner := public.current_partner_id();
  if partner is null then
    raise exception 'Only linked partner users can request payouts';
  end if;

  if commission_ids is null or cardinality(commission_ids) = 0 then
    raise exception 'Select at least one commission';
  end if;

  select count(*) into invalid_count
  from public.commissions c
  where c.id = any(commission_ids)
    and (
      c.partner_id <> partner
      or c.state not in ('Unpaid', 'Approved')
    );

  if invalid_count > 0 then
    raise exception 'One or more commissions are not eligible for payout';
  end if;

  if (select count(*) from public.commissions c where c.id = any(commission_ids)) <> cardinality(commission_ids) then
    raise exception 'One or more commissions were not found';
  end if;

  select coalesce(sum(amount), 0) into total
  from public.commissions
  where id = any(commission_ids);

  insert into public.payout_requests (partner_id, requested_by, amount, message)
  values (partner, auth.uid(), total, nullif(trim(coalesce(message, '')), ''))
  returning * into request_row;

  insert into public.payout_request_items (payout_request_id, commission_id, amount)
  select request_row.id, c.id, c.amount
  from public.commissions c
  where c.id = any(commission_ids);

  update public.commissions
  set state = 'Payout Requested'
  where id = any(commission_ids);

  insert into public.notifications (recipient_id, title, body, type, mandatory)
  select p.id, 'Payout request submitted', request_row.id::text || ' - ' || total::text, 'info', true
  from public.profiles p
  where p.role in ('admin', 'super_admin');

  perform public.record_audit(
    'Payout Requested',
    'Payouts',
    request_row.id::text,
    total::text,
    null,
    jsonb_build_object('commission_ids', commission_ids, 'amount', total)
  );

  return request_row;
end;
$$;

grant execute on function public.request_commission_payout(uuid[], text) to authenticated;
