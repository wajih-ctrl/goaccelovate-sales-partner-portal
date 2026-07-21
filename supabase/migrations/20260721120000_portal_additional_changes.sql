-- Additional production requirements: editable invitation agreements, announcement
-- engagement, permanent Admin stage ownership, payment cycles, and payout details.

alter table public.invitations
  add column if not exists agreement_text text;

alter table public.leads
  add column if not exists stage_admin_locked boolean not null default false,
  add column if not exists payment_cycle integer not null default 0 check (payment_cycle >= 0);

alter table public.client_payments
  add column if not exists payment_cycle integer not null default 0 check (payment_cycle >= 0);

alter table public.payout_requests
  add column if not exists preferred_bank text,
  add column if not exists preferred_payment_method text,
  add column if not exists tax_liability boolean;

alter table public.announcements
  add column if not exists attachment_name text,
  add column if not exists attachment_bucket text,
  add column if not exists attachment_path text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size bigint;

insert into public.settings (key, value, description)
values (
  'announcement_attachment_max_bytes',
  '2097152'::jsonb,
  'Maximum announcement attachment size in bytes; configurable pending final approval'
)
on conflict (key) do nothing;

create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  actor_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists announcement_comments_announcement_idx
  on public.announcement_comments (announcement_id, created_at);

create table if not exists public.announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('Like', 'Celebrate', 'Insightful')),
  created_at timestamptz not null default now(),
  unique (announcement_id, actor_id)
);

alter table public.announcement_comments enable row level security;
alter table public.announcement_reactions enable row level security;

drop policy if exists announcement_comments_select on public.announcement_comments;
create policy announcement_comments_select on public.announcement_comments
for select to authenticated
using (public.is_admin() or public.partner_can_read_announcement(announcement_id));

drop policy if exists announcement_comments_insert on public.announcement_comments;
create policy announcement_comments_insert on public.announcement_comments
for insert to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.account_status = 'active'
  )
  and (public.is_admin() or public.partner_can_read_announcement(announcement_id))
);

drop policy if exists announcement_comments_delete_own on public.announcement_comments;
create policy announcement_comments_delete_own on public.announcement_comments
for delete to authenticated
using (actor_id = auth.uid() or public.is_super_admin());

drop policy if exists announcement_reactions_select on public.announcement_reactions;
create policy announcement_reactions_select on public.announcement_reactions
for select to authenticated
using (public.is_admin() or public.partner_can_read_announcement(announcement_id));

drop policy if exists announcement_reactions_insert on public.announcement_reactions;
create policy announcement_reactions_insert on public.announcement_reactions
for insert to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.account_status = 'active'
  )
  and (public.is_admin() or public.partner_can_read_announcement(announcement_id))
);

drop policy if exists announcement_reactions_update_own on public.announcement_reactions;
create policy announcement_reactions_update_own on public.announcement_reactions
for update to authenticated
using (actor_id = auth.uid())
with check (actor_id = auth.uid());

drop policy if exists announcement_reactions_delete_own on public.announcement_reactions;
create policy announcement_reactions_delete_own on public.announcement_reactions
for delete to authenticated
using (actor_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-attachments',
  'announcement-attachments',
  false,
  52428800,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_announcement_attachments_insert on storage.objects;
create policy storage_announcement_attachments_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'announcement-attachments'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists storage_announcement_attachments_select on storage.objects;
create policy storage_announcement_attachments_select on storage.objects
for select to authenticated
using (
  bucket_id = 'announcement-attachments'
  and exists (
    select 1
    from public.announcements announcement
    where announcement.attachment_path = name
      and (public.is_admin() or public.partner_can_read_announcement(announcement.id))
  )
);

drop policy if exists storage_announcement_attachments_delete on storage.objects;
create policy storage_announcement_attachments_delete on storage.objects
for delete to authenticated
using (bucket_id = 'announcement-attachments' and public.is_super_admin());

create or replace function public.get_current_partner_invitation_agreement()
returns table (
  agreement_text text,
  signer_name text,
  signer_role public.app_role,
  signed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    invitation.agreement_text,
    coalesce(nullif(trim(invitation.agreement_signer_name), ''), actor.full_name, actor.email::text),
    coalesce(invitation.agreement_signer_role, actor.role),
    coalesce(invitation.agreement_signed_at, invitation.created_at)
  from public.invitations invitation
  left join public.profiles actor on actor.id = invitation.invited_by
  where invitation.partner_id = public.current_partner_id()
    and invitation.revoked_at is null
  order by invitation.created_at desc
  limit 1;
$$;

revoke all on function public.get_current_partner_invitation_agreement() from public, anon;
grant execute on function public.get_current_partner_invitation_agreement() to authenticated;

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
  normalized_phone text := regexp_replace(coalesce(contact_phone, ''), '[^0-9]+', '', 'g');
begin
  select * into row_before from public.leads where id = target_lead for update;
  if row_before.id is null or not public.is_current_partner(row_before.partner_id) then
    raise exception 'Lead access denied';
  end if;
  if row_before.status in ('Closed Won', 'Closed Lost', 'Duplicate Rejected') then
    raise exception 'Closed or rejected leads cannot be edited';
  end if;
  if coalesce(trim(company_name), '') = '' or coalesce(trim(contact_name), '') = ''
     or coalesce(trim(contact_title), '') = '' or coalesce(trim(country), '') = ''
     or coalesce(trim(industry), '') = '' then
    raise exception 'Complete all required lead fields';
  end if;
  if lower(trim(contact_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid contact email';
  end if;
  if estimated_value is null or estimated_value <= 0 then
    raise exception 'Estimated deal value must be positive';
  end if;
  if char_length(trim(description)) < 50 then
    raise exception 'Description must contain at least 50 characters';
  end if;
  if exists (
    select 1 from public.leads existing
    where existing.id <> target_lead
      and (
        lower(trim(existing.contact_email::text)) = lower(trim(contact_email))
        or (
          normalized_phone <> ''
          and regexp_replace(coalesce(existing.contact_phone, ''), '[^0-9]+', '', 'g') = normalized_phone
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

revoke all on function public.update_own_partner_lead(uuid,text,text,text,text,text,text,text,text,numeric,text,text) from public, anon;
grant execute on function public.update_own_partner_lead(uuid,text,text,text,text,text,text,text,text,numeric,text,text) to authenticated;

-- Sales Partners may edit their own lead details but may never delete lead records.
revoke all on function public.delete_own_partner_lead(uuid) from authenticated;

create or replace function public.add_lead_comment_secure(
  target_lead uuid,
  comment_text text,
  private_comment boolean default false,
  mentioned_users uuid[] default '{}'::uuid[]
)
returns public.lead_activity_log
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.app_role := public.current_user_role();
  lead_row public.leads;
  comment_row public.lead_activity_log;
begin
  select * into lead_row from public.leads where id = target_lead;
  if lead_row.id is null then raise exception 'Lead not found'; end if;
  if coalesce(trim(comment_text), '') = '' then raise exception 'Comment cannot be empty'; end if;
  if char_length(trim(comment_text)) > 2000 then raise exception 'Comment cannot exceed 2,000 characters'; end if;
  if actor_role = 'partner' then
    if not public.is_current_partner(lead_row.partner_id) then raise exception 'Lead access denied'; end if;
    if private_comment then raise exception 'Sales Partners cannot create private notes'; end if;
    if exists (
      select 1 from unnest(mentioned_users) mentioned(id)
      left join public.profiles profile on profile.id = mentioned.id
      where profile.id is null or profile.role not in ('admin','super_admin') or profile.account_status <> 'active'
    ) then
      raise exception 'Sales Partners may mention only active Admin or Super Admin users';
    end if;
  elsif actor_role not in ('admin', 'super_admin') then
    raise exception 'Comment access denied';
  end if;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text, is_private)
  select target_lead,
    case when private_comment then 'admin_note' else 'comment' end,
    auth.uid(), coalesce(full_name, email::text), trim(comment_text), private_comment
  from public.profiles where id = auth.uid()
  returning * into comment_row;

  update public.leads set last_activity_at = now(), updated_at = now() where id = target_lead;

  if actor_role = 'partner' then
    insert into public.notifications (recipient_id, title, body, type, mandatory)
    select profile.id, 'Mentioned in a lead comment',
      lead_row.company_name || ': ' || left(trim(comment_text), 240), 'info', false
    from public.profiles profile
    where profile.id = any(mentioned_users) and profile.id <> auth.uid();
  elsif not private_comment then
    insert into public.notifications (partner_id, title, body, type, mandatory)
    values (lead_row.partner_id, 'New lead comment',
      lead_row.company_name || ': ' || left(trim(comment_text), 240), 'info', false);
  end if;
  return comment_row;
end;
$$;

revoke all on function public.add_lead_comment_secure(uuid,text,boolean,uuid[]) from public, anon;
grant execute on function public.add_lead_comment_secure(uuid,text,boolean,uuid[]) to authenticated;

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
  partner_stages text[] := array['Identified Opportunity','Outreach Started','In Communication','Discovery Call'];
  next_cycle integer;
begin
  select * into row_before from public.leads where id = target_lead for update;
  if row_before.id is null then raise exception 'Lead not found'; end if;
  if row_before.stage = target_stage then raise exception 'Lead is already in that stage'; end if;

  if actor_role = 'partner' then
    if not public.is_current_partner(row_before.partner_id) then raise exception 'Lead access denied'; end if;
    if row_before.stage_admin_locked then
      raise exception 'An Admin has taken ownership of this lead stage. Contact your account manager for updates';
    end if;
    if row_before.status = 'Duplicate Rejected' then raise exception 'Rejected duplicate leads cannot enter the pipeline'; end if;
    if row_before.stage::text in ('Closed Won', 'Closed Lost') then raise exception 'Closed leads cannot be moved by Sales Partners'; end if;
    if row_before.stage::text = 'On Hold' then
      if row_before.previous_stage is null or target_stage <> row_before.previous_stage then
        raise exception 'An On Hold lead must resume to its previous stage';
      end if;
      if not (row_before.previous_stage::text = any(partner_stages)) then
        raise exception 'Only Admin or Super Admin can resume this lead';
      end if;
    elsif target_stage::text not in ('On Hold', 'Closed Lost') then
      if not (row_before.stage::text = any(partner_stages)) or not (target_stage::text = any(partner_stages)) then
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

  next_cycle := row_before.payment_cycle;
  if actor_role in ('admin','super_admin')
     and target_stage::text in ('Advance Pending','Advance Confirmed')
     and row_before.stage::text not in ('Advance Pending','Advance Confirmed')
     and exists (
       select 1 from public.client_payments payment
       where payment.lead_id = target_lead
         and payment.payment_type = 'Advance'
         and payment.payment_cycle = row_before.payment_cycle
     ) then
    next_cycle := row_before.payment_cycle + 1;
  end if;

  update public.leads set
    previous_stage = case when target_stage::text = 'On Hold' and stage::text <> 'On Hold' then stage else previous_stage end,
    stage = target_stage,
    status = case
      when target_stage::text = 'Closed Won' then 'Closed Won'::public.lead_status
      when target_stage::text = 'Closed Lost' then 'Closed Lost'::public.lead_status
      else 'Open'::public.lead_status
    end,
    closed_reason = case when target_stage::text = 'Closed Lost' then trim(change_reason) else closed_reason end,
    stage_admin_locked = case when actor_role in ('admin','super_admin') then true else stage_admin_locked end,
    payment_cycle = next_cycle,
    last_activity_at = now(), updated_at = now()
  where id = target_lead returning * into row_after;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text)
  select target_lead, 'stage_change', auth.uid(), coalesce(full_name, email::text),
    'Stage changed: ' || row_before.stage::text || ' -> ' || target_stage::text ||
    case when change_reason is null then '' else '. Reason: ' || trim(change_reason) end
  from public.profiles where id = auth.uid();

  if actor_role in ('admin','super_admin') then
    insert into public.notifications (partner_id, title, body, type, mandatory)
    values (row_before.partner_id, 'Lead stage updated',
      row_before.company_name || ' moved from ' || row_before.stage::text || ' to ' || target_stage::text || '.',
      case when target_stage::text = 'Closed Lost' then 'warning' else 'info' end,
      target_stage::text in ('Closed Won','Closed Lost'));
  end if;

  perform public.record_audit('Stage Change','Leads',target_lead::text,row_before.company_name,
    jsonb_build_object('stage',row_before.stage,'admin_locked',row_before.stage_admin_locked,'payment_cycle',row_before.payment_cycle),
    jsonb_build_object('stage',target_stage,'admin_locked',row_after.stage_admin_locked,'payment_cycle',next_cycle,'reason',change_reason));
  return row_after;
end;
$$;

revoke all on function public.update_lead_stage_secure(uuid,public.lead_stage,text) from public, anon;
grant execute on function public.update_lead_stage_secure(uuid,public.lead_stage,text) to authenticated;

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
  if payment_type not in ('Advance','Final') then raise exception 'Payment type must be Advance or Final'; end if;
  if payment_amount is null or payment_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  if payment_date is null then raise exception 'Payment date is required'; end if;
  if coalesce(trim(payment_reference),'') = '' then raise exception 'Payment reference is required'; end if;
  if coalesce(trim(payment_method),'') = '' then raise exception 'Payment method is required'; end if;

  select * into lead_row from public.leads where id = target_lead for update;
  if lead_row.id is null then raise exception 'Lead not found'; end if;
  if payment_type = 'Advance' and lead_row.stage::text not in (
    'Advance Confirmed','Sent to Product','Done by Product','Client Review','Under Revisions','Final Payment Clearance','Final Handoff','Closed Won'
  ) then raise exception 'Advance payments can only be recorded from Advance Confirmed onward'; end if;
  if payment_type = 'Final' and lead_row.stage::text not in ('Final Payment Clearance','Final Handoff','Closed Won') then
    raise exception 'Final payments can only be recorded from Final Payment Clearance onward';
  end if;
  if exists (
    select 1 from public.client_payments payment
    where payment.lead_id = target_lead
      and payment.payment_type = record_client_payment_and_eligibility.payment_type
      and payment.payment_cycle = lead_row.payment_cycle
  ) then
    raise exception '% payment has already been recorded for this payment cycle', payment_type;
  end if;

  insert into public.client_payments (
    lead_id,amount_received,received_date,payment_method,payment_reference,notes,
    trigger_commission_eligibility,payment_type,payment_cycle,created_by
  ) values (
    target_lead,payment_amount,payment_date,trim(payment_method),trim(payment_reference),
    nullif(trim(payment_notes),''),true,payment_type,lead_row.payment_cycle,auth.uid()
  ) returning * into payment_row;

  if not exists (select 1 from public.commissions where lead_id=target_lead and kind='Deal') then
    insert into public.commissions (lead_id,partner_id,kind,rate,base_amount,amount,state,created_by)
    select lead_row.id,lead_row.partner_id,'Deal',profile.commission_rate,
      coalesce(lead_row.confirmed_value,lead_row.estimated_value),
      round(coalesce(lead_row.confirmed_value,lead_row.estimated_value)*profile.commission_rate/100.0,2),
      'On Hold',auth.uid()
    from public.partner_profiles profile where profile.id=lead_row.partner_id;
  end if;
  select * into commission_row from public.commissions
  where lead_id=target_lead and kind='Deal' order by created_at limit 1 for update;
  if commission_row.id is not null then
    release_amount := case when payment_type='Final' then commission_row.amount-commission_row.eligible_amount
      else least(commission_row.amount-commission_row.eligible_amount,round(payment_amount*commission_row.rate/100.0,2)) end;
    release_amount := greatest(release_amount,0);
    if release_amount > 0 then
      update public.commissions set eligible_amount=eligible_amount+release_amount,
        state=case when state in ('Payout Requested','Approved','Disputed') then state
          when paid_amount>=eligible_amount+release_amount then 'Paid'::public.commission_state
          else 'Unpaid'::public.commission_state end,
        updated_at=now() where id=commission_row.id;
      insert into public.notifications(partner_id,title,body,type,mandatory)
      values(lead_row.partner_id,
        case when payment_type='Advance' then 'Advance commission now payable' else 'Final commission now payable' end,
        lead_row.company_name || ': ' || release_amount || ' in commission is now available for payout.','success',true);
    end if;
  end if;
  perform public.record_audit('Client Payment Recorded','Client Payments',payment_row.id::text,lead_row.company_name,null,
    jsonb_build_object('type',payment_type,'amount',payment_amount,'reference',trim(payment_reference),'payment_cycle',lead_row.payment_cycle,'commission_released',release_amount));
  return payment_row;
end;
$$;

revoke all on function public.record_client_payment_and_eligibility(uuid,numeric,date,text,text,text,text) from public, anon;
grant execute on function public.record_client_payment_and_eligibility(uuid,numeric,date,text,text,text,text) to authenticated;

revoke all on function public.request_commission_payout(uuid[],text) from authenticated;

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
  selected record;
  allocation numeric;
begin
  if partner is null then raise exception 'Only linked Sales Partners can request payouts'; end if;
  if coalesce(cardinality(commission_ids),0)=0 then raise exception 'Select at least one commission'; end if;
  if requested_amount is null or requested_amount<=0 then raise exception 'Requested payout amount must be positive'; end if;
  if coalesce(trim(preferred_bank),'')='' then raise exception 'Preferred bank is required'; end if;
  if preferred_method not in ('Bank Transfer','ACH Transfer','Wire Transfer') then raise exception 'Select a supported payout method'; end if;
  if liable_for_taxes is null then raise exception 'Tax liability selection is required'; end if;
  if exists (
    select 1 from unnest(commission_ids) selected(id)
    left join public.commissions commission on commission.id=selected.id
    where commission.id is null or commission.partner_id<>partner
      or commission.state<>'Unpaid' or commission.eligible_amount-commission.paid_amount<=0
  ) then raise exception 'One or more commissions are not currently payable'; end if;
  select sum(eligible_amount-paid_amount) into available_total from public.commissions where id=any(commission_ids);
  if requested_amount>available_total then raise exception 'Requested amount exceeds the selected payable balance'; end if;

  insert into public.payout_requests(
    partner_id,requested_by,amount,status,message,preferred_bank,preferred_payment_method,tax_liability
  ) values(
    partner,auth.uid(),requested_amount,'Pending',nullif(trim(message),''),trim(preferred_bank),preferred_method,liable_for_taxes
  ) returning * into request_row;

  remaining := requested_amount;
  for selected in
    select commission.id, commission.eligible_amount-commission.paid_amount as available
    from unnest(commission_ids) with ordinality requested(id, position)
    join public.commissions commission on commission.id=requested.id
    order by requested.position
  loop
    exit when remaining<=0;
    allocation := least(remaining,selected.available);
    insert into public.payout_request_items(payout_request_id,commission_id,amount)
    values(request_row.id,selected.id,allocation);
    update public.commissions set state='Payout Requested' where id=selected.id;
    remaining := remaining-allocation;
  end loop;

  insert into public.notifications(recipient_id,title,body,type,mandatory)
  select id,'New payout request',
    'A Sales Partner requested a payout of ' || requested_amount || ' via ' || preferred_method || '.',
    'info',true
  from public.profiles where role='super_admin' and account_status='active' and id<>auth.uid();
  perform public.record_audit('Payout Requested','Payouts',request_row.id::text,'Payout request',null,
    jsonb_build_object('amount',requested_amount,'preferred_bank',trim(preferred_bank),'preferred_method',preferred_method,'tax_liability',liable_for_taxes));
  return request_row;
end;
$$;

revoke all on function public.request_commission_payout(uuid[],numeric,text,text,boolean,text) from public, anon;
grant execute on function public.request_commission_payout(uuid[],numeric,text,text,boolean,text) to authenticated;

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
declare row_before public.payout_requests; row_after public.payout_requests;
begin
  if not public.is_super_admin() then raise exception 'Only Super Admin can approve or reject payouts'; end if;
  select * into row_before from public.payout_requests where id=target_payout for update;
  if row_before.id is null then raise exception 'Payout request not found'; end if;
  if row_before.status<>'Pending' then raise exception 'Only pending payout requests can be reviewed'; end if;
  if not approve_request and coalesce(trim(rejection_reason),'')='' then raise exception 'A rejection reason is required'; end if;
  update public.payout_requests set
    status=case when approve_request then 'Approved' else 'Rejected' end,
    approved_by=case when approve_request then auth.uid() else null end,
    approved_at=case when approve_request then now() else null end,
    reject_reason=case when approve_request then null else trim(rejection_reason) end,
    updated_at=now()
  where id=target_payout returning * into row_after;
  update public.commissions commission set
    state=case when approve_request then 'Approved'::public.commission_state else 'Unpaid'::public.commission_state end,
    updated_at=now()
  from public.payout_request_items item
  where item.payout_request_id=target_payout and item.commission_id=commission.id;
  insert into public.notifications(partner_id,title,body,type,mandatory)
  values(row_before.partner_id,case when approve_request then 'Payout approved' else 'Payout rejected' end,
    case when approve_request then 'Your payout request for '||row_before.amount||' was approved and is awaiting external payment.'
      else 'Your payout request for '||row_before.amount||' was rejected. Reason: '||trim(rejection_reason) end,
    case when approve_request then 'success' else 'warning' end,true);
  perform public.record_audit(case when approve_request then 'Payout Approved' else 'Payout Rejected' end,
    'Payouts',target_payout::text,'Payout request',to_jsonb(row_before),to_jsonb(row_after));
  return row_after;
end;
$$;

revoke all on function public.review_payout_request(uuid,boolean,text) from public, anon;
grant execute on function public.review_payout_request(uuid,boolean,text) to authenticated;

create or replace function public.record_payout_paid(
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
declare row_before public.payout_requests; row_after public.payout_requests;
begin
  if not public.is_super_admin() then raise exception 'Only Super Admin can record payout payments'; end if;
  if paid_on is null then raise exception 'Payment date is required'; end if;
  if coalesce(trim(method),'')='' then raise exception 'Payment method is required'; end if;
  if coalesce(trim(reference),'')='' then raise exception 'Transaction reference is required'; end if;
  select * into row_before from public.payout_requests where id=target_payout for update;
  if row_before.id is null or row_before.status<>'Approved' then raise exception 'Approved payout not found'; end if;
  if payment_amount is null or abs(payment_amount-row_before.amount)>0.005 then raise exception 'Paid amount must match the approved payout amount'; end if;
  update public.payout_requests set status='Paid',paid_amount=payment_amount,paid_date=paid_on,
    payment_method=trim(method),transaction_reference=trim(reference),updated_at=now()
  where id=target_payout returning * into row_after;
  update public.commissions commission set
    paid_amount=least(commission.amount,commission.paid_amount+item.amount),
    state=case when least(commission.amount,commission.paid_amount+item.amount)>=commission.amount
      then 'Paid'::public.commission_state else 'Unpaid'::public.commission_state end,
    updated_at=now()
  from public.payout_request_items item where item.payout_request_id=target_payout and item.commission_id=commission.id;
  insert into public.notifications(partner_id,title,body,type,mandatory)
  values(row_after.partner_id,'Payout confirmed',
    'Your payout of '||row_after.amount||' was paid via '||trim(method)||'. Reference: '||trim(reference)||'.','success',true);
  perform public.record_audit('Payout Paid','Payouts',target_payout::text,'Payout request',to_jsonb(row_before),to_jsonb(row_after));
  return row_after;
end;
$$;

revoke all on function public.record_payout_paid(uuid,numeric,date,text,text) from public, anon;
grant execute on function public.record_payout_paid(uuid,numeric,date,text,text) to authenticated;

do $$
declare target_table text;
begin
  foreach target_table in array array['announcements','announcement_comments','announcement_reactions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=target_table
    ) then execute format('alter publication supabase_realtime add table public.%I',target_table);
    end if;
  end loop;
end $$;
