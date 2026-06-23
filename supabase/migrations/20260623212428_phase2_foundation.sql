create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.app_role as enum ('super_admin', 'admin', 'partner');
create type public.account_status as enum ('active', 'suspended', 'pending', 'deactivated');
create type public.partner_tier as enum ('Associate', 'Specialist', 'Partner');
create type public.lead_stage as enum (
  'New Lead',
  'In Conversation',
  'Discovery Call',
  'Proposal Sent',
  'Negotiation',
  'Closed Won',
  'Closed Lost'
);
create type public.lead_status as enum (
  'Active',
  'On Hold',
  'Closed Won',
  'Closed Lost',
  'Duplicate Under Review',
  'Duplicate Rejected',
  'Disqualified',
  'Reopened'
);
create type public.activity_type as enum (
  'stage_change',
  'status_change',
  'comment',
  'partner_update',
  'discovery_call',
  'file',
  'admin_note',
  'system'
);
create type public.commission_state as enum (
  'Unpaid',
  'Payout Requested',
  'Approved',
  'Paid',
  'Disputed',
  'On Hold',
  'Waived'
);
create type public.commission_kind as enum ('Deal', 'Monthly Retainer', 'One-off Bonus');
create type public.payout_status as enum ('Pending', 'Approved', 'Rejected', 'Paid');
create type public.dispute_status as enum ('Open', 'Under Review', 'Resolved', 'Rejected');
create type public.announcement_priority as enum ('General', 'Important', 'Urgent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text not null default '',
  role public.app_role not null default 'partner',
  account_status public.account_status not null default 'pending',
  partner_id uuid,
  avatar_url text,
  email_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  email citext not null unique,
  phone text not null default '',
  linkedin text not null default '',
  city text not null default '',
  country text not null default '',
  bio text not null default '',
  tier public.partner_tier not null default 'Associate',
  commission_rate numeric(5,2) not null default 8 check (commission_rate >= 0 and commission_rate <= 100),
  status public.account_status not null default 'pending',
  assigned_contact text not null default '',
  joined_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_partner_id_fkey foreign key (partner_id) references public.partner_profiles(id) on delete set null;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  role public.app_role not null,
  tier public.partner_tier,
  partner_id uuid references public.partner_profiles(id) on delete set null,
  invited_by uuid references public.profiles(id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.partner_onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles(id) on delete cascade,
  step_id uuid not null references public.onboarding_steps(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  unique (partner_id, step_id)
);

create table public.partner_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles(id) on delete cascade,
  name text not null,
  document_type text not null default 'Other',
  storage_bucket text not null default 'partner-documents',
  storage_path text not null,
  is_private boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  public_id text unique,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  company_name text not null,
  contact_name text not null,
  contact_title text not null,
  contact_email citext not null,
  contact_phone text,
  country text not null,
  industry text not null,
  estimated_value numeric(14,2) not null check (estimated_value > 0),
  currency text not null,
  description text not null check (char_length(description) >= 50),
  stage public.lead_stage not null default 'New Lead',
  status public.lead_status not null default 'Active',
  confirmed_value numeric(14,2) check (confirmed_value is null or confirmed_value > 0),
  closed_reason text,
  duplicate_reason text,
  duplicate_reviewed_by uuid references public.profiles(id) on delete set null,
  duplicate_reviewed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_partner_idx on public.leads(partner_id);
create index leads_company_lower_idx on public.leads(lower(company_name));
create index leads_contact_email_lower_idx on public.leads(lower(contact_email::text));

create table public.lead_attachments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  name text not null,
  storage_bucket text not null default 'lead-attachments',
  storage_path text not null,
  is_private boolean not null default false,
  uploaded_at timestamptz not null default now()
);

create table public.lead_activity_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  type public.activity_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null default 'System',
  text text not null,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.discovery_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  call_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  goaccelovate_attendees text not null,
  client_attendees text not null,
  partner_joined boolean not null default false,
  summary text not null,
  outcomes text not null,
  next_steps text not null,
  follow_up_date date,
  recording_url text,
  is_private boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.discovery_call_attachments (
  id uuid primary key default gen_random_uuid(),
  discovery_call_id uuid not null references public.discovery_calls(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  name text not null,
  storage_bucket text not null default 'discovery-call-files',
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  kind public.commission_kind not null default 'Deal',
  label text,
  rate numeric(5,2) not null default 0 check (rate >= 0 and rate <= 100),
  base_amount numeric(14,2),
  amount numeric(14,2) not null check (amount >= 0),
  state public.commission_state not null default 'On Hold',
  override_reason text,
  waived_reason text,
  closed_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index commissions_partner_idx on public.commissions(partner_id);
create index commissions_lead_idx on public.commissions(lead_id);

create table public.commission_bonuses (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid references public.commissions(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  partner_id uuid not null references public.partner_profiles(id) on delete cascade,
  label text not null,
  amount numeric(14,2) not null check (amount > 0),
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  requested_by uuid references public.profiles(id) on delete set null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  status public.payout_status not null default 'Pending',
  message text,
  reject_reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  paid_amount numeric(14,2),
  paid_date date,
  payment_method text,
  transaction_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payout_request_items (
  id uuid primary key default gen_random_uuid(),
  payout_request_id uuid not null references public.payout_requests(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete restrict,
  amount numeric(14,2) not null check (amount >= 0),
  unique (payout_request_id, commission_id)
);

create table public.client_payments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  amount_received numeric(14,2) not null check (amount_received > 0),
  received_date date not null,
  payment_method text not null,
  payment_reference text not null,
  notes text,
  trigger_commission_eligibility boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  opened_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  status public.dispute_status not null default 'Open',
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  partner_id uuid references public.partner_profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'info',
  mandatory boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  priority public.announcement_priority not null default 'General',
  target_type text not null default 'all_partners',
  target_rules jsonb not null default '{}'::jsonb,
  send_email boolean not null default false,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  partner_id uuid not null references public.partner_profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, partner_id)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null default 'System',
  action text not null,
  module text not null,
  record_id text,
  record_name text,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger partner_profiles_touch_updated_at before update on public.partner_profiles
  for each row execute function public.touch_updated_at();
create trigger leads_touch_updated_at before update on public.leads
  for each row execute function public.touch_updated_at();
create trigger commissions_touch_updated_at before update on public.commissions
  for each row execute function public.touch_updated_at();
create trigger payout_requests_touch_updated_at before update on public.payout_requests
  for each row execute function public.touch_updated_at();
create trigger disputes_touch_updated_at before update on public.disputes
  for each row execute function public.touch_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'super_admin', false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('super_admin', 'admin'), false)
$$;

create or replace function public.is_current_partner(partner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_partner_id() = partner, false)
$$;

create or replace function public.is_partner_lead(lead uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leads l
    where l.id = lead and l.partner_id = public.current_partner_id()
  )
$$;

create or replace function public.partner_can_read_announcement(announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.announcements a
    join public.partner_profiles p on p.id = public.current_partner_id()
    where a.id = announcement_id
      and a.archived_at is null
      and (
        a.target_type = 'all_partners'
        or (a.target_type = 'tier' and a.target_rules -> 'tiers' ? p.tier::text)
        or (a.target_type = 'region' and a.target_rules -> 'countries' ? p.country)
        or (a.target_type = 'selected_partners' and a.target_rules -> 'partner_ids' ? p.id::text)
      )
  )
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.app_role;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' in ('super_admin', 'admin', 'partner')
      then (new.raw_user_meta_data ->> 'role')::public.app_role
    else 'partner'::public.app_role
  end;

  insert into public.profiles (id, email, full_name, role, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    requested_role,
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if not public.is_super_admin() and (
    new.role is distinct from old.role
    or new.account_status is distinct from old.account_status
    or new.partner_id is distinct from old.partner_id
  ) then
    raise exception 'Only Super Admin can change role, account status, or partner link';
  end if;

  return new;
end;
$$;

create trigger profiles_prevent_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

create or replace function public.prevent_partner_controlled_field_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if not public.is_admin() and (
    new.tier is distinct from old.tier
    or new.commission_rate is distinct from old.commission_rate
    or new.status is distinct from old.status
    or new.assigned_contact is distinct from old.assigned_contact
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Partners cannot change admin-controlled profile fields';
  end if;

  return new;
end;
$$;

create trigger partner_profiles_prevent_controlled_updates
  before update on public.partner_profiles
  for each row execute function public.prevent_partner_controlled_field_update();

create or replace function public.validate_lead_status_requirements()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('Closed Lost', 'Disqualified', 'Duplicate Rejected', 'Reopened') and coalesce(new.closed_reason, new.duplicate_reason, '') = '' then
    raise exception 'A reason is required for status %', new.status;
  end if;

  if new.stage = 'Closed Won' and new.confirmed_value is null then
    raise exception 'Closed Won requires confirmed deal value';
  end if;

  return new;
end;
$$;

create trigger leads_validate_status_requirements
  before insert or update on public.leads
  for each row execute function public.validate_lead_status_requirements();

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit log is append-only';
end;
$$;

create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.prevent_audit_log_mutation();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.prevent_audit_log_mutation();

create or replace function public.record_audit(
  action text,
  module text,
  record_id text default null,
  record_name text default null,
  old_value jsonb default null,
  new_value jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  insert into public.audit_log (actor_id, actor_name, action, module, record_id, record_name, old_value, new_value)
  select
    auth.uid(),
    coalesce(p.full_name, 'System'),
    action,
    module,
    record_id,
    record_name,
    old_value,
    new_value
  from public.profiles p
  where p.id = auth.uid()
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.activate_current_profile(new_full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.profiles;
begin
  update public.profiles
  set
    full_name = coalesce(nullif(trim(new_full_name), ''), profiles.full_name),
    account_status = case
      when account_status = 'pending' then 'active'::public.account_status
      else account_status
    end
  where id = auth.uid()
    and account_status <> 'suspended'
  returning * into profile;

  if profile.id is null then
    raise exception 'Profile cannot be activated';
  end if;

  return profile;
end;
$$;

alter table public.profiles enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.settings enable row level security;
alter table public.onboarding_steps enable row level security;
alter table public.partner_onboarding_steps enable row level security;
alter table public.partner_documents enable row level security;
alter table public.leads enable row level security;
alter table public.lead_attachments enable row level security;
alter table public.lead_activity_log enable row level security;
alter table public.discovery_calls enable row level security;
alter table public.discovery_call_attachments enable row level security;
alter table public.commissions enable row level security;
alter table public.commission_bonuses enable row level security;
alter table public.payout_requests enable row level security;
alter table public.payout_request_items enable row level security;
alter table public.client_payments enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_self_or_super on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());
create policy profiles_insert_super on public.profiles
  for insert to authenticated
  with check (public.is_super_admin());
create policy profiles_delete_super on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

create policy partner_profiles_select on public.partner_profiles
  for select to authenticated
  using (public.is_admin() or public.is_current_partner(id));
create policy partner_profiles_insert_admin on public.partner_profiles
  for insert to authenticated
  with check (public.is_admin());
create policy partner_profiles_update_admin_or_owner on public.partner_profiles
  for update to authenticated
  using (public.is_admin() or public.is_current_partner(id))
  with check (public.is_admin() or public.is_current_partner(id));
create policy partner_profiles_delete_super on public.partner_profiles
  for delete to authenticated
  using (public.is_super_admin());

create policy invitations_super_all on public.invitations
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy settings_select_authenticated on public.settings
  for select to authenticated
  using (true);
create policy settings_write_super on public.settings
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy onboarding_steps_select on public.onboarding_steps
  for select to authenticated
  using (true);
create policy onboarding_steps_write_super on public.onboarding_steps
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy partner_onboarding_select on public.partner_onboarding_steps
  for select to authenticated
  using (public.is_admin() or public.is_current_partner(partner_id));
create policy partner_onboarding_write_admin on public.partner_onboarding_steps
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy partner_documents_select on public.partner_documents
  for select to authenticated
  using (public.is_admin() or (public.is_current_partner(partner_id) and not is_private));
create policy partner_documents_insert_admin on public.partner_documents
  for insert to authenticated
  with check (public.is_admin());
create policy partner_documents_update_admin on public.partner_documents
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy partner_documents_delete_admin on public.partner_documents
  for delete to authenticated
  using (public.is_admin());

create policy leads_select on public.leads
  for select to authenticated
  using (public.is_admin() or public.is_current_partner(partner_id));
create policy leads_insert on public.leads
  for insert to authenticated
  with check (public.is_admin() or public.is_current_partner(partner_id));
create policy leads_update_admin on public.leads
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy leads_delete_super on public.leads
  for delete to authenticated
  using (public.is_super_admin());

create policy lead_attachments_select on public.lead_attachments
  for select to authenticated
  using (public.is_admin() or (public.is_partner_lead(lead_id) and not is_private));
create policy lead_attachments_insert on public.lead_attachments
  for insert to authenticated
  with check (public.is_admin() or public.is_partner_lead(lead_id));
create policy lead_attachments_update_admin on public.lead_attachments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy lead_attachments_delete_admin on public.lead_attachments
  for delete to authenticated
  using (public.is_admin());

create policy activity_select on public.lead_activity_log
  for select to authenticated
  using (public.is_admin() or (lead_id is not null and public.is_partner_lead(lead_id) and not is_private));
create policy activity_insert on public.lead_activity_log
  for insert to authenticated
  with check (public.is_admin() or (lead_id is not null and public.is_partner_lead(lead_id) and not is_private));

create policy discovery_calls_select on public.discovery_calls
  for select to authenticated
  using (public.is_admin() or (public.is_partner_lead(lead_id) and not is_private));
create policy discovery_calls_write_admin on public.discovery_calls
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy discovery_attachments_select on public.discovery_call_attachments
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.discovery_calls dc
      where dc.id = discovery_call_id
        and public.is_partner_lead(dc.lead_id)
        and not dc.is_private
    )
  );
create policy discovery_attachments_write_admin on public.discovery_call_attachments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy commissions_select on public.commissions
  for select to authenticated
  using (public.is_admin() or public.is_current_partner(partner_id));
create policy commissions_write_admin on public.commissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy commission_bonuses_select on public.commission_bonuses
  for select to authenticated
  using (public.is_admin() or public.is_current_partner(partner_id));
create policy commission_bonuses_write_admin on public.commission_bonuses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy payout_requests_select on public.payout_requests
  for select to authenticated
  using (public.is_admin() or public.is_current_partner(partner_id));
create policy payout_requests_insert_partner on public.payout_requests
  for insert to authenticated
  with check (public.is_current_partner(partner_id));
create policy payout_requests_update_admin on public.payout_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy payout_items_select on public.payout_request_items
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.payout_requests pr
      where pr.id = payout_request_id and public.is_current_partner(pr.partner_id)
    )
  );
create policy payout_items_insert_partner on public.payout_request_items
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.payout_requests pr
      join public.commissions c on c.id = commission_id
      where pr.id = payout_request_id
        and public.is_current_partner(pr.partner_id)
        and c.partner_id = pr.partner_id
        and c.state = 'Unpaid'
    )
  );
create policy payout_items_update_admin on public.payout_request_items
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy client_payments_admin_only on public.client_payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy disputes_select on public.disputes
  for select to authenticated
  using (public.is_admin() or public.is_current_partner(partner_id));
create policy disputes_insert_partner on public.disputes
  for insert to authenticated
  with check (public.is_current_partner(partner_id));
create policy disputes_update_admin on public.disputes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy dispute_messages_select on public.dispute_messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.disputes d
      where d.id = dispute_id and public.is_current_partner(d.partner_id)
    )
  );
create policy dispute_messages_insert on public.dispute_messages
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.disputes d
      where d.id = dispute_id and public.is_current_partner(d.partner_id)
    )
  );

create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid() or (partner_id is not null and public.is_current_partner(partner_id)) or public.is_admin());
create policy notifications_update_read on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid() or (partner_id is not null and public.is_current_partner(partner_id)) or public.is_admin())
  with check (recipient_id = auth.uid() or (partner_id is not null and public.is_current_partner(partner_id)) or public.is_admin());
create policy notifications_insert_admin on public.notifications
  for insert to authenticated
  with check (public.is_admin());

create policy announcements_select on public.announcements
  for select to authenticated
  using (public.is_admin() or public.partner_can_read_announcement(id));
create policy announcements_write_admin on public.announcements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy announcement_reads_select on public.announcement_reads
  for select to authenticated
  using (public.is_admin() or public.is_current_partner(partner_id));
create policy announcement_reads_insert_partner on public.announcement_reads
  for insert to authenticated
  with check (public.is_current_partner(partner_id));

create policy audit_log_select_super on public.audit_log
  for select to authenticated
  using (public.is_super_admin());
create policy audit_log_insert_self on public.audit_log
  for insert to authenticated
  with check (actor_id = auth.uid() or public.is_admin());

insert into public.settings (key, value, description)
values
  ('default_commission_rates', '{"Associate": 8, "Specialist": 10, "Partner": 12}'::jsonb, 'Default commission rates by partner tier'),
  ('lead_staleness_threshold_days', '21'::jsonb, 'Number of days with no activity before a lead is stale'),
  ('payout_window_days', '30'::jsonb, 'Default payout window after eligible client payment'),
  ('supported_currencies', '["USD", "EUR", "GBP", "JPY", "INR", "AED", "BRL"]'::jsonb, 'Currencies allowed for lead submission'),
  ('industries', '["SaaS", "Manufacturing", "FinTech", "HealthTech", "Logistics", "Retail", "Energy", "Education"]'::jsonb, 'Industry dropdown options'),
  ('pipeline_stage_labels', '["New Lead", "In Conversation", "Discovery Call", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"]'::jsonb, 'Pipeline stage labels'),
  ('partner_tier_labels', '["Associate", "Specialist", "Partner"]'::jsonb, 'Partner tier labels'),
  ('invitation_expiry_hours', '72'::jsonb, 'Default invitation expiry window')
on conflict (key) do nothing;

insert into public.onboarding_steps (key, label, sort_order)
values
  ('agreement', 'Agreement signed', 10),
  ('nda', 'NDA signed', 20),
  ('profile', 'Profile fully filled in', 30),
  ('welcome', 'Welcome kit acknowledged', 40),
  ('enablement', 'Enablement session attended', 50),
  ('firstLead', 'First lead submitted', 60),
  ('activation', 'Activation confirmed by Admin', 70)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('lead-attachments', 'lead-attachments', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('partner-documents', 'partner-documents', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('discovery-call-files', 'discovery-call-files', false, 104857600, array['application/pdf', 'image/png', 'image/jpeg', 'audio/mpeg', 'video/mp4', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy storage_partner_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'partner-documents'
    and (
      public.is_admin()
      or exists (
        select 1 from public.partner_documents d
        where d.storage_bucket = bucket_id
          and d.storage_path = name
          and public.is_current_partner(d.partner_id)
          and not d.is_private
      )
    )
  );
create policy storage_partner_documents_write_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'partner-documents' and public.is_admin())
  with check (bucket_id = 'partner-documents' and public.is_admin());

create policy storage_lead_attachments_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lead-attachments'
    and (
      public.is_admin()
      or exists (
        select 1 from public.lead_attachments a
        where a.storage_bucket = bucket_id
          and a.storage_path = name
          and public.is_partner_lead(a.lead_id)
          and not a.is_private
      )
    )
  );
create policy storage_lead_attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lead-attachments' and (public.is_admin() or public.current_partner_id() is not null));
create policy storage_lead_attachments_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'lead-attachments' and public.is_admin())
  with check (bucket_id = 'lead-attachments' and public.is_admin());
create policy storage_lead_attachments_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'lead-attachments' and public.is_admin());

create policy storage_discovery_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'discovery-call-files'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.discovery_call_attachments a
        join public.discovery_calls dc on dc.id = a.discovery_call_id
        where a.storage_bucket = bucket_id
          and a.storage_path = name
          and public.is_partner_lead(dc.lead_id)
          and not dc.is_private
      )
    )
  );
create policy storage_discovery_files_write_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'discovery-call-files' and public.is_admin())
  with check (bucket_id = 'discovery-call-files' and public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.record_audit(text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.activate_current_profile(text) to authenticated;
