alter table public.partner_profiles
  add column if not exists agreements_required boolean not null default false;

alter table public.invitations
  add column if not exists commission_rate numeric(5,2)
  check (commission_rate is null or (commission_rate > 0 and commission_rate <= 100));

alter table public.leads
  add column if not exists client_linkedin text,
  add column if not exists previous_stage public.lead_stage;

alter table public.client_payments
  add column if not exists payment_type text
  check (payment_type is null or payment_type in ('Advance', 'Final'));

alter table public.commissions
  add column if not exists eligible_amount numeric(14,2) not null default 0
  check (eligible_amount >= 0),
  add column if not exists paid_amount numeric(14,2) not null default 0
  check (paid_amount >= 0);

-- Legacy status validation requires a reason before these rows can be converted.
update public.leads
set duplicate_reason = coalesce(
  nullif(trim(duplicate_reason), ''),
  'Automatically rejected during migration: legacy duplicate review.'
)
where status::text = 'Duplicate Under Review';

update public.leads
set closed_reason = coalesce(
  nullif(trim(closed_reason), ''),
  'Closed during migration: legacy disqualified lead.'
)
where status::text = 'Disqualified';

update public.leads
set stage = case stage::text
  when 'New Lead' then 'Identified Opportunity'::public.lead_stage
  when 'In Conversation' then 'In Communication'::public.lead_stage
  when 'Proposal Sent' then 'Contract Sent'::public.lead_stage
  when 'Negotiation' then 'Advance Pending'::public.lead_stage
  else stage
end,
status = case
  when status::text in ('Active', 'On Hold', 'Reopened') then 'Open'::public.lead_status
  when status::text = 'Duplicate Under Review' then 'Duplicate Rejected'::public.lead_status
  when status::text = 'Disqualified' then 'Closed Lost'::public.lead_status
  else status
end;

alter table public.leads alter column stage set default 'Identified Opportunity';
alter table public.leads alter column status set default 'Open';

insert into public.settings(key,value,description)
values(
  'pipeline_stage_labels',
  '["Identified Opportunity","Outreach Started","In Communication","Discovery Call","On Hold","Contract Sent","Advance Pending","Advance Confirmed","Sent to Product","Done by Product","Client Review","Under Revisions","Final Payment Clearance","Final Handoff","Closed Won","Closed Lost"]'::jsonb,
  'Global Partner Program pipeline stages'
)
on conflict(key) do update set value=excluded.value,description=excluded.description,updated_at=now();

delete from public.settings where key='partner_tier_labels';

create table if not exists public.agreement_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('Agreement', 'NDA')),
  title text not null,
  version integer not null check (version > 0),
  content_url text,
  content_hash text,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_type, version)
);

create unique index if not exists agreement_documents_one_active_type
  on public.agreement_documents(document_type) where is_active;

create table if not exists public.partner_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles(id) on delete cascade,
  agreement_document_id uuid not null references public.agreement_documents(id) on delete restrict,
  signer_name text not null,
  signer_email citext not null,
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  unique (partner_id, agreement_document_id)
);

alter table public.agreement_documents enable row level security;
alter table public.partner_agreement_acceptances enable row level security;

create policy agreement_documents_read on public.agreement_documents
for select using (auth.role() = 'authenticated');

create policy agreement_documents_write_super on public.agreement_documents
for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy agreement_acceptances_read on public.partner_agreement_acceptances
for select using (public.is_admin() or public.is_current_partner(partner_id));

create policy agreement_acceptances_insert_own on public.partner_agreement_acceptances
for insert with check (public.is_current_partner(partner_id));

create or replace function public.partner_agreements_complete(check_partner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not coalesce((select agreements_required from public.partner_profiles where id = check_partner), false)
      then true
    when (select count(*) from public.agreement_documents where is_active) < 2
      then false
    else not exists (
      select 1 from public.agreement_documents d
      where d.is_active
        and not exists (
          select 1 from public.partner_agreement_acceptances a
          where a.partner_id = check_partner and a.agreement_document_id = d.id
        )
    )
  end;
$$;

grant execute on function public.partner_agreements_complete(uuid) to authenticated;

create or replace function public.accept_required_partner_agreements(
  signer_name text,
  signer_email text,
  browser_user_agent text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid := public.current_partner_id();
  inserted_count integer;
begin
  if partner is null then raise exception 'Only linked Sales Partners can sign agreements'; end if;
  if coalesce(trim(signer_name), '') = '' then raise exception 'Legal name is required'; end if;
  if lower(trim(signer_email)) <> lower((select email::text from public.profiles where id = auth.uid())) then
    raise exception 'Signer email must match the signed-in account';
  end if;
  if (select count(*) from public.agreement_documents where is_active and content_url is not null) < 2 then
    raise exception 'The current Agreement and NDA are not available yet';
  end if;

  insert into public.partner_agreement_acceptances (
    partner_id, agreement_document_id, signer_name, signer_email, user_agent
  )
  select partner, id, trim(signer_name), lower(trim(signer_email)), browser_user_agent
  from public.agreement_documents
  where is_active
  on conflict (partner_id, agreement_document_id) do nothing;
  get diagnostics inserted_count = row_count;

  perform public.record_audit(
    'Required Agreements Signed', 'Onboarding', partner::text, trim(signer_name), null,
    jsonb_build_object('documents_signed', inserted_count)
  );
  return inserted_count;
end;
$$;

grant execute on function public.accept_required_partner_agreements(text, text, text) to authenticated;

create or replace function public.publish_required_agreements(
  agreement_url text,
  nda_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  agreement_version integer;
  nda_version integer;
begin
  if not public.is_super_admin() then raise exception 'Only Super Admin can publish agreement documents'; end if;
  if agreement_url !~* '^https://' or nda_url !~* '^https://' then raise exception 'Both documents require secure HTTPS URLs'; end if;
  select coalesce(max(version),0)+1 into agreement_version from public.agreement_documents where document_type='Agreement';
  select coalesce(max(version),0)+1 into nda_version from public.agreement_documents where document_type='NDA';
  update public.agreement_documents set is_active=false where is_active;
  insert into public.agreement_documents(document_type,title,version,content_url,is_active,created_by)
  values
    ('Agreement','Global Partner Program Agreement',agreement_version,trim(agreement_url),true,auth.uid()),
    ('NDA','Global Partner Program NDA',nda_version,trim(nda_url),true,auth.uid());
  perform public.record_audit('Agreement Documents Published','Onboarding',null,'Agreement and NDA',null,
    jsonb_build_object('agreement_version',agreement_version,'nda_version',nda_version));
end;
$$;

grant execute on function public.publish_required_agreements(text, text) to authenticated;

create or replace function public.partner_can_read_announcement(announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.announcements a
    join public.partner_profiles p on p.id=public.current_partner_id()
    where a.id=announcement_id and a.archived_at is null and (
      a.target_type in ('all_partners','all_users')
      or (a.target_type='region' and a.target_rules->'countries' ? p.country)
      or (a.target_type='selected_partners' and a.target_rules->'partner_ids' ? p.id::text)
    )
  );
$$;

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
  partner_allowed text[] := array['Identified Opportunity','Outreach Started','In Communication','Discovery Call'];
begin
  select * into row_before from public.leads where id = target_lead for update;
  if row_before.id is null then raise exception 'Lead not found'; end if;
  if row_before.stage::text = 'On Hold' and target_stage::text <> coalesce(row_before.previous_stage::text, '') then
    raise exception 'An On Hold lead must resume to its previous stage';
  end if;
  if actor_role = 'partner' and not public.is_current_partner(row_before.partner_id) then raise exception 'Lead access denied'; end if;
  if actor_role = 'partner' then
    if row_before.status = 'Duplicate Rejected' then raise exception 'Rejected duplicate leads cannot enter the pipeline'; end if;
    if row_before.stage::text in ('Closed Won', 'Closed Lost') then
      raise exception 'Closed leads cannot be moved by Sales Partners';
    end if;
    if row_before.stage::text in ('Contract Sent','Advance Pending','Advance Confirmed','Sent to Product','Done by Product','Client Review','Under Revisions','Final Payment Clearance','Final Handoff')
       and target_stage::text not in ('On Hold', 'Closed Lost') then
      raise exception 'Only an administrator can move a lead from an administrator-controlled stage';
    end if;
    if target_stage::text not in ('On Hold', 'Closed Lost') and not (target_stage::text = any(partner_allowed)) then
      raise exception 'Sales Partners cannot move leads into administrator-controlled stages';
    end if;
    if row_before.stage::text = 'On Hold' and not (target_stage::text = any(partner_allowed)) then
      raise exception 'Only an administrator can resume this lead';
    end if;
  elsif actor_role not in ('admin', 'super_admin') then
    raise exception 'Lead stage access denied';
  end if;
  if target_stage::text = 'Closed Lost' and coalesce(trim(change_reason), '') = '' then
    raise exception 'A Closed Lost reason is required';
  end if;
  if target_stage::text = 'Closed Won' and row_before.confirmed_value is null then
    raise exception 'Closed Won requires a confirmed deal value';
  end if;

  update public.leads set
    previous_stage = case when target_stage::text = 'On Hold' and stage::text <> 'On Hold' then stage else previous_stage end,
    stage = target_stage,
    status = case when target_stage::text = 'Closed Won' then 'Closed Won'::public.lead_status
                  when target_stage::text = 'Closed Lost' then 'Closed Lost'::public.lead_status
                  else 'Open'::public.lead_status end,
    closed_reason = case when target_stage::text = 'Closed Lost' then trim(change_reason) else closed_reason end,
    last_activity_at = now(), updated_at = now()
  where id = target_lead returning * into row_after;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
  select target_lead, 'stage_change', auth.uid(), coalesce(full_name, email::text),
    'Stage changed: ' || row_before.stage::text || ' -> ' || target_stage::text ||
      case when change_reason is null then '' else '. Reason: ' || trim(change_reason) end
  from public.profiles where id = auth.uid();

  insert into public.notifications (partner_id, title, body, type, mandatory)
  values (row_before.partner_id, 'Lead stage updated', row_before.company_name || ' moved to ' || target_stage::text,
    case when target_stage::text = 'Closed Lost' then 'warning' else 'info' end, target_stage::text in ('Closed Won','Closed Lost'));

  perform public.record_audit('Stage Change', 'Leads', target_lead::text, row_before.company_name,
    jsonb_build_object('stage', row_before.stage), jsonb_build_object('stage', target_stage, 'reason', change_reason));
  return row_after;
end;
$$;

grant execute on function public.update_lead_stage_secure(uuid, public.lead_stage, text) to authenticated;

create or replace function public.delete_own_partner_lead(target_lead uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare row_before public.leads;
begin
  select * into row_before from public.leads where id = target_lead for update;
  if row_before.id is null or not public.is_current_partner(row_before.partner_id) then raise exception 'Lead access denied'; end if;
  if exists (select 1 from public.commissions where lead_id = target_lead) then raise exception 'A lead with commission records cannot be deleted'; end if;
  perform public.record_audit('Lead Deleted by Partner', 'Leads', target_lead::text, row_before.company_name, to_jsonb(row_before), null);
  delete from public.leads where id = target_lead;
end;
$$;

grant execute on function public.delete_own_partner_lead(uuid) to authenticated;

drop policy if exists storage_lead_attachments_delete_own on storage.objects;
create policy storage_lead_attachments_delete_own on storage.objects
for delete to authenticated
using (bucket_id = 'lead-attachments' and (public.is_admin() or name like auth.uid()::text || '/%'));

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
  release_amount numeric;
begin
  if not public.is_admin() then raise exception 'Only Admin users can record client payments'; end if;
  if payment_type not in ('Advance', 'Final') then raise exception 'Payment type must be Advance or Final'; end if;
  select * into lead_row from public.leads where id = target_lead for update;
  if lead_row.id is null then raise exception 'Lead not found'; end if;
  if payment_amount is null or payment_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  if payment_type = 'Advance' and lead_row.stage::text not in ('Advance Confirmed','Sent to Product','Done by Product','Client Review','Under Revisions','Final Payment Clearance','Final Handoff','Closed Won') then
    raise exception 'Advance payments can only be recorded from Advance Confirmed onward';
  end if;
  if payment_type = 'Final' and lead_row.stage::text not in ('Final Payment Clearance','Final Handoff','Closed Won') then
    raise exception 'Final payments can only be recorded from Final Payment Clearance onward';
  end if;

  insert into public.client_payments (
    lead_id, amount_received, received_date, payment_method, payment_reference, notes,
    trigger_commission_eligibility, payment_type, created_by
  ) values (
    target_lead, payment_amount, payment_date, trim(payment_method), trim(payment_reference),
    nullif(trim(payment_notes), ''), true, payment_type, auth.uid()
  ) returning * into payment_row;

  if not exists (select 1 from public.commissions where lead_id=target_lead and kind='Deal') then
    insert into public.commissions(
      lead_id,partner_id,kind,rate,base_amount,amount,state,created_by
    )
    select lead_row.id,lead_row.partner_id,'Deal',p.commission_rate,
      coalesce(lead_row.confirmed_value,lead_row.estimated_value),
      round(coalesce(lead_row.confirmed_value,lead_row.estimated_value) * p.commission_rate / 100.0,2),
      'On Hold',auth.uid()
    from public.partner_profiles p where p.id=lead_row.partner_id;
  end if;

  select * into commission_row from public.commissions
  where lead_id = target_lead and kind = 'Deal' order by created_at limit 1 for update;
  if commission_row.id is not null then
    release_amount := least(
      commission_row.amount - commission_row.eligible_amount,
      round(payment_amount * commission_row.rate / 100.0, 2)
    );
    if release_amount > 0 then
      update public.commissions set
        eligible_amount = eligible_amount + release_amount,
        state = case when state in ('Paid','Payout Requested','Approved') then state else 'Unpaid'::public.commission_state end
      where id = commission_row.id;
      insert into public.notifications (partner_id, title, body, type, mandatory)
      values (lead_row.partner_id, 'Commission eligibility triggered',
        lead_row.company_name || ': ' || payment_type || ' payment triggered ' || release_amount || ' in payable commission.',
        'success', true);
    end if;
  end if;

  perform public.record_audit('Client Payment Recorded', 'Client Payments', payment_row.id::text,
    lead_row.company_name, null, jsonb_build_object('type', payment_type, 'amount', payment_amount, 'reference', payment_reference));
  return payment_row;
end;
$$;

grant execute on function public.record_client_payment_and_eligibility(uuid, numeric, date, text, text, text, text) to authenticated;

create or replace function public.request_commission_payout(commission_ids uuid[], message text default null)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid := public.current_partner_id();
  request_row public.payout_requests;
  total numeric;
begin
  if partner is null then raise exception 'Only linked Sales Partners can request payouts'; end if;
  if coalesce(cardinality(commission_ids), 0) = 0 then raise exception 'Select at least one commission'; end if;
  if exists (
    select 1
    from unnest(commission_ids) as selected(id)
    left join public.commissions c on c.id = selected.id
    where c.id is null or c.partner_id <> partner
  ) then
    raise exception 'Commission access denied';
  end if;
  if exists (select 1 from public.commissions c where c.id = any(commission_ids) and (c.state <> 'Unpaid' or c.eligible_amount - c.paid_amount <= 0)) then
    raise exception 'One or more commissions are not currently payable';
  end if;
  select sum(eligible_amount - paid_amount) into total from public.commissions where id = any(commission_ids);
  insert into public.payout_requests(partner_id, requested_by, amount, status, message)
  values(partner, auth.uid(), total, 'Pending', nullif(trim(message), '')) returning * into request_row;
  insert into public.payout_request_items(payout_request_id, commission_id, amount)
  select request_row.id, id, eligible_amount - paid_amount from public.commissions where id = any(commission_ids);
  update public.commissions set state = 'Payout Requested' where id = any(commission_ids);
  insert into public.notifications(recipient_id, title, body, type, mandatory)
  select id, 'New payout request', request_row.id || ' for ' || total, 'info', true
  from public.profiles where role in ('admin','super_admin') and account_status='active';
  perform public.record_audit('Payout Requested','Payouts',request_row.id::text,request_row.id::text,null,to_jsonb(request_row));
  return request_row;
end;
$$;

grant execute on function public.request_commission_payout(uuid[], text) to authenticated;

create or replace function public.record_payout_paid(
  target_payout uuid, paid_on date, method text, reference text
)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare row_after public.payout_requests;
begin
  if not public.is_admin() then raise exception 'Only Admin users can record payouts'; end if;
  update public.payout_requests set status='Paid', paid_amount=amount, paid_date=paid_on,
    payment_method=trim(method), transaction_reference=trim(reference), updated_at=now()
  where id=target_payout and status='Approved' returning * into row_after;
  if row_after.id is null then raise exception 'Approved payout not found'; end if;
  update public.commissions c set
    paid_amount = least(c.amount, c.paid_amount + i.amount),
    state = case when least(c.amount, c.paid_amount + i.amount) >= c.amount then 'Paid'::public.commission_state else 'Unpaid'::public.commission_state end
  from public.payout_request_items i where i.payout_request_id=target_payout and i.commission_id=c.id;
  insert into public.notifications(partner_id,title,body,type,mandatory)
  values(row_after.partner_id,'Payout confirmed',target_payout || ' paid via ' || trim(method) || '. Reference: ' || trim(reference),'success',true);
  perform public.record_audit('Payout Paid','Payouts',target_payout::text,target_payout::text,null,to_jsonb(row_after));
  return row_after;
end;
$$;

grant execute on function public.record_payout_paid(uuid, date, text, text) to authenticated;

drop policy if exists invitations_super_all on public.invitations;
create policy invitations_admin_read on public.invitations for select using (public.is_admin());
create policy invitations_super_write on public.invitations for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists leads_delete_super on public.leads;
create policy leads_delete_super on public.leads for delete using (public.is_super_admin());

-- Retire superseded workflows so they cannot be invoked directly through PostgREST.
drop function if exists public.submit_partner_lead(uuid, text, text, text, text, text, text, text, numeric, text, text);
drop function if exists public.review_duplicate_lead(uuid, boolean, text);
drop function if exists public.open_commission_dispute(uuid, text);
drop function if exists public.trigger_commission_eligibility(uuid, text);

drop policy if exists disputes_select on public.disputes;
drop policy if exists disputes_insert_partner on public.disputes;
drop policy if exists disputes_update_admin on public.disputes;
create policy disputes_admin_history on public.disputes
for select to authenticated using (public.is_admin());

drop policy if exists dispute_messages_select on public.dispute_messages;
drop policy if exists dispute_messages_insert on public.dispute_messages;
create policy dispute_messages_admin_history on public.dispute_messages
for select to authenticated using (public.is_admin());

create or replace function public.submit_partner_lead(
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
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid := public.current_partner_id();
  inserted public.leads;
  duplicate_found boolean;
  duplicate_reason text;
  first_lead_step uuid;
  supported_currencies jsonb;
begin
  if partner is null then raise exception 'Only linked Sales Partners can submit leads'; end if;
  if not public.partner_agreements_complete(partner) then raise exception 'Sign the current Agreement and NDA before submitting leads'; end if;
  if coalesce(trim(company_name), '') = '' then raise exception 'Company name is required'; end if;
  if coalesce(trim(contact_name), '') = '' then raise exception 'Contact name is required'; end if;
  if coalesce(trim(contact_title), '') = '' then raise exception 'Job title is required'; end if;
  if coalesce(trim(contact_email), '') = '' then raise exception 'Email is required'; end if;
  if contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email format'; end if;
  if coalesce(trim(country), '') = '' then raise exception 'Country is required'; end if;
  if coalesce(trim(industry), '') = '' then raise exception 'Industry is required'; end if;
  if estimated_value is null or estimated_value <= 0 then raise exception 'Value must be a positive number'; end if;
  if char_length(trim(description)) < 50 then raise exception 'Message must contain at least 50 characters'; end if;
  if array_length(regexp_split_to_array(trim(description), '\s+'), 1) > 1000 then raise exception 'Maximum 1,000 words allowed'; end if;

  select value into supported_currencies from public.settings where key='supported_currencies';
  if supported_currencies is not null and not (supported_currencies ? currency) then raise exception 'Unsupported currency'; end if;

  select exists (
    select 1 from public.leads l
    where lower(l.contact_email::text)=lower(trim(submit_partner_lead.contact_email))
       or lower(l.company_name)=lower(trim(submit_partner_lead.company_name))
  ) into duplicate_found;
  duplicate_reason := case when duplicate_found then 'Automatically rejected: company name or contact email already exists.' else null end;

  insert into public.leads(
    id,partner_id,company_name,contact_name,contact_title,contact_email,contact_phone,
    client_linkedin,country,industry,estimated_value,currency,description,stage,status,
    duplicate_reason,duplicate_reviewed_at,created_by
  ) values (
    lead_id,partner,trim(company_name),trim(contact_name),trim(contact_title),lower(trim(contact_email)),
    nullif(trim(contact_phone),''),nullif(trim(client_linkedin),''),trim(country),trim(industry),
    estimated_value,trim(currency),trim(description),'Identified Opportunity',
    case when duplicate_found then 'Duplicate Rejected'::public.lead_status else 'Open'::public.lead_status end,
    duplicate_reason,case when duplicate_found then now() else null end,auth.uid()
  ) returning * into inserted;

  insert into public.lead_activity_log(lead_id,type,actor_id,actor_name,text)
  values(inserted.id,'system',auth.uid(),'System',
    case when duplicate_found then duplicate_reason else 'Lead accepted automatically into Identified Opportunity' end);

  insert into public.notifications(recipient_id,title,body,type,mandatory)
  select id,
    case when duplicate_found then 'Duplicate lead automatically rejected' else 'New lead submitted' end,
    inserted.company_name || case when duplicate_found then ' was automatically rejected as a duplicate.' else ' entered the pipeline.' end,
    case when duplicate_found then 'warning' else 'info' end,false
  from public.profiles where role in ('admin','super_admin') and account_status='active';

  insert into public.notifications(recipient_id,partner_id,title,body,type,mandatory)
  values(auth.uid(),partner,
    case when duplicate_found then 'Duplicate lead rejected' else 'Lead accepted into pipeline' end,
    case when duplicate_found then inserted.company_name || ': ' || duplicate_reason else inserted.company_name || ' entered Identified Opportunity.' end,
    case when duplicate_found then 'warning' else 'success' end,duplicate_found);

  if not duplicate_found then
    select id into first_lead_step from public.onboarding_steps where key='firstLead' limit 1;
    if first_lead_step is not null then
      insert into public.partner_onboarding_steps(partner_id,step_id,completed,completed_at,completed_by)
      values(partner,first_lead_step,true,now(),auth.uid())
      on conflict(partner_id,step_id) do update set completed=true,completed_at=now(),completed_by=auth.uid();
    end if;
  end if;

  perform public.record_audit(
    case when duplicate_found then 'Lead Automatically Rejected - Duplicate' else 'Lead Submitted' end,
    'Leads',inserted.id::text,inserted.company_name,null,to_jsonb(inserted)
  );
  return inserted;
end;
$$;

grant execute on function public.submit_partner_lead(uuid,text,text,text,text,text,text,text,text,numeric,text,text) to authenticated;
