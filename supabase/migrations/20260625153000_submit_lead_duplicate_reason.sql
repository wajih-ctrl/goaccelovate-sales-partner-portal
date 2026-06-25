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
  duplicate_reason text;
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

  duplicate_reason := case
    when duplicate_found then 'Potential duplicate detected by company name or contact email.'
    else null
  end;

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
    duplicate_reason,
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
    duplicate_reason,
    auth.uid()
  )
  returning * into inserted;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
  select inserted.id, 'system', auth.uid(), coalesce(p.full_name, 'Partner'), 'Lead submitted: ' || inserted.company_name
  from public.profiles p
  where p.id = auth.uid();

  if duplicate_found then
    insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
    values (inserted.id, 'system', auth.uid(), 'System', duplicate_reason);
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
    case when duplicate_found then inserted.company_name || ': ' || duplicate_reason else inserted.company_name end,
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
