-- Qualify lead-edit parameters that share names with table columns.

create or replace function public.update_own_partner_lead(
  target_lead uuid,
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
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  row_before public.leads;
  row_after public.leads;
  normalized_phone text := regexp_replace(
    coalesce(update_own_partner_lead.contact_phone, ''),
    '[^0-9]+', '', 'g'
  );
begin
  select * into row_before from public.leads where id = target_lead for update;
  if row_before.id is null or not public.is_current_partner(row_before.partner_id) then
    raise exception 'Lead access denied';
  end if;
  if row_before.status in ('Closed Won', 'Closed Lost', 'Duplicate Rejected') then
    raise exception 'Closed or rejected leads cannot be edited';
  end if;
  if coalesce(trim(update_own_partner_lead.company_name), '') = ''
     or coalesce(trim(update_own_partner_lead.contact_name), '') = ''
     or coalesce(trim(update_own_partner_lead.contact_title), '') = ''
     or coalesce(trim(update_own_partner_lead.country), '') = ''
     or coalesce(trim(update_own_partner_lead.industry), '') = '' then
    raise exception 'Complete all required lead fields';
  end if;
  if lower(trim(update_own_partner_lead.contact_email))
     !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid contact email';
  end if;
  if update_own_partner_lead.estimated_value is null
     or update_own_partner_lead.estimated_value <= 0 then
    raise exception 'Estimated deal value must be positive';
  end if;
  if char_length(trim(update_own_partner_lead.description)) < 50 then
    raise exception 'Description must contain at least 50 characters';
  end if;
  if exists (
    select 1 from public.leads existing
    where existing.id <> target_lead
      and (
        lower(trim(existing.contact_email::text)) =
          lower(trim(update_own_partner_lead.contact_email))
        or (
          normalized_phone <> ''
          and regexp_replace(coalesce(existing.contact_phone, ''), '[^0-9]+', '', 'g') =
            normalized_phone
        )
      )
  ) then
    raise exception 'Another lead already uses this contact email or phone number';
  end if;

  update public.leads set
    company_name = trim(update_own_partner_lead.company_name),
    contact_name = trim(update_own_partner_lead.contact_name),
    contact_title = trim(update_own_partner_lead.contact_title),
    contact_email = lower(trim(update_own_partner_lead.contact_email)),
    contact_phone = nullif(trim(update_own_partner_lead.contact_phone), ''),
    client_linkedin = nullif(trim(update_own_partner_lead.client_linkedin), ''),
    country = trim(update_own_partner_lead.country),
    industry = trim(update_own_partner_lead.industry),
    estimated_value = update_own_partner_lead.estimated_value,
    currency = trim(update_own_partner_lead.currency),
    description = trim(update_own_partner_lead.description),
    last_activity_at = now(),
    updated_at = now()
  where id = target_lead
  returning * into row_after;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
  select target_lead, 'partner_update', auth.uid(), coalesce(full_name, email::text),
    'Lead details updated by Sales Partner'
  from public.profiles where id = auth.uid();
  perform public.record_audit(
    'Lead Details Updated', 'Leads', target_lead::text, row_after.company_name,
    to_jsonb(row_before) - array['id','created_at','updated_at','last_activity_at'],
    to_jsonb(row_after) - array['id','created_at','updated_at','last_activity_at']
  );
  return row_after;
end;
$$;

revoke all on function public.update_own_partner_lead(
  uuid,text,text,text,text,text,text,text,text,numeric,text,text
) from public, anon;
grant execute on function public.update_own_partner_lead(
  uuid,text,text,text,text,text,text,text,text,numeric,text,text
) to authenticated;
