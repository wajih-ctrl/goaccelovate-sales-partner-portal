-- Keep partner onboarding progress synchronized with real partner actions.

create or replace function public.sync_partner_profile_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_step uuid;
  profile_complete boolean;
begin
  select id into profile_step
  from public.onboarding_steps
  where key = 'profile' and active
  limit 1;

  if profile_step is null then
    return new;
  end if;

  profile_complete :=
    coalesce(trim(new.name), '') <> '' and
    coalesce(trim(new.email::text), '') <> '' and
    coalesce(trim(new.phone), '') <> '' and
    coalesce(trim(new.city), '') <> '' and
    coalesce(trim(new.country), '') <> '' and
    coalesce(trim(new.bio), '') <> '';

  insert into public.partner_onboarding_steps (
    partner_id, step_id, completed, completed_at, completed_by
  )
  values (
    new.id,
    profile_step,
    profile_complete,
    case when profile_complete then now() else null end,
    case when profile_complete then coalesce(auth.uid(), new.user_id) else null end
  )
  on conflict (partner_id, step_id) do update
  set
    completed = excluded.completed,
    completed_at = case
      when excluded.completed and not partner_onboarding_steps.completed then excluded.completed_at
      when excluded.completed then partner_onboarding_steps.completed_at
      else null
    end,
    completed_by = case
      when excluded.completed then coalesce(excluded.completed_by, partner_onboarding_steps.completed_by)
      else null
    end;

  return new;
end;
$$;

drop trigger if exists partner_profiles_sync_onboarding on public.partner_profiles;
create trigger partner_profiles_sync_onboarding
after insert or update of name, email, phone, city, country, bio
on public.partner_profiles
for each row execute function public.sync_partner_profile_onboarding();

revoke all on function public.sync_partner_profile_onboarding() from public, anon, authenticated;

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

  insert into public.partner_onboarding_steps (
    partner_id, step_id, completed, completed_at, completed_by
  )
  select partner, step.id, true, now(), auth.uid()
  from public.onboarding_steps step
  where step.key in ('agreement', 'nda')
    and step.active
    and exists (
      select 1
      from public.agreement_documents document
      join public.partner_agreement_acceptances acceptance
        on acceptance.agreement_document_id = document.id
       and acceptance.partner_id = partner
      where document.is_active
        and lower(document.document_type) = step.key
    )
  on conflict (partner_id, step_id) do update
  set completed = true,
      completed_at = coalesce(partner_onboarding_steps.completed_at, excluded.completed_at),
      completed_by = excluded.completed_by;

  perform public.record_audit(
    'Required Agreements Signed', 'Onboarding', partner::text, trim(signer_name), null,
    jsonb_build_object('documents_signed', inserted_count, 'onboarding_access', 'complete')
  );
  return inserted_count;
end;
$$;

grant execute on function public.accept_required_partner_agreements(text, text, text) to authenticated;

create or replace function public.acknowledge_partner_welcome_kit()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid := public.current_partner_id();
  welcome_step uuid;
begin
  if partner is null then raise exception 'Only linked Sales Partners can acknowledge the welcome kit'; end if;
  if not public.partner_agreements_complete(partner) then
    raise exception 'Sign the current Agreement and NDA before acknowledging the welcome kit';
  end if;

  select id into welcome_step
  from public.onboarding_steps
  where key = 'welcome' and active
  limit 1;
  if welcome_step is null then raise exception 'Welcome kit onboarding step is not configured'; end if;

  insert into public.partner_onboarding_steps (
    partner_id, step_id, completed, completed_at, completed_by
  )
  values (partner, welcome_step, true, now(), auth.uid())
  on conflict (partner_id, step_id) do update
  set completed = true,
      completed_at = coalesce(partner_onboarding_steps.completed_at, excluded.completed_at),
      completed_by = excluded.completed_by;

  perform public.record_audit(
    'Welcome Kit Acknowledged', 'Onboarding', partner::text, 'GoAccelovate Welcome Kit', null,
    jsonb_build_object('acknowledged', true)
  );
  return true;
end;
$$;

revoke all on function public.acknowledge_partner_welcome_kit() from public, anon;
grant execute on function public.acknowledge_partner_welcome_kit() to authenticated;

-- Backfill existing legal acceptances and complete profiles.
insert into public.partner_onboarding_steps (
  partner_id, step_id, completed, completed_at, completed_by
)
select acceptance.partner_id, step.id, true, min(acceptance.signed_at), profile.user_id
from public.partner_agreement_acceptances acceptance
join public.agreement_documents document
  on document.id = acceptance.agreement_document_id and document.is_active
join public.onboarding_steps step
  on step.key = lower(document.document_type) and step.active
join public.partner_profiles profile on profile.id = acceptance.partner_id
group by acceptance.partner_id, step.id, profile.user_id
on conflict (partner_id, step_id) do update
set completed = true,
    completed_at = coalesce(partner_onboarding_steps.completed_at, excluded.completed_at),
    completed_by = coalesce(excluded.completed_by, partner_onboarding_steps.completed_by);

insert into public.partner_onboarding_steps (
  partner_id, step_id, completed, completed_at, completed_by
)
select
  profile.id,
  step.id,
  (
    coalesce(trim(profile.name), '') <> '' and
    coalesce(trim(profile.email::text), '') <> '' and
    coalesce(trim(profile.phone), '') <> '' and
    coalesce(trim(profile.city), '') <> '' and
    coalesce(trim(profile.country), '') <> '' and
    coalesce(trim(profile.bio), '') <> ''
  ),
  case when
    coalesce(trim(profile.name), '') <> '' and
    coalesce(trim(profile.email::text), '') <> '' and
    coalesce(trim(profile.phone), '') <> '' and
    coalesce(trim(profile.city), '') <> '' and
    coalesce(trim(profile.country), '') <> '' and
    coalesce(trim(profile.bio), '') <> ''
  then now() else null end,
  case when
    coalesce(trim(profile.name), '') <> '' and
    coalesce(trim(profile.email::text), '') <> '' and
    coalesce(trim(profile.phone), '') <> '' and
    coalesce(trim(profile.city), '') <> '' and
    coalesce(trim(profile.country), '') <> '' and
    coalesce(trim(profile.bio), '') <> ''
  then profile.user_id else null end
from public.partner_profiles profile
cross join public.onboarding_steps step
where step.key = 'profile' and step.active
on conflict (partner_id, step_id) do update
set completed = excluded.completed,
    completed_at = case when excluded.completed then coalesce(partner_onboarding_steps.completed_at, excluded.completed_at) else null end,
    completed_by = case when excluded.completed then coalesce(excluded.completed_by, partner_onboarding_steps.completed_by) else null end;

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

  insert into public.partner_onboarding_steps (
    partner_id, step_id, completed, completed_at, completed_by
  )
  select profile.id, step.id, false, null, null
  from public.partner_profiles profile
  cross join public.onboarding_steps step
  where profile.agreements_required
    and step.key in ('agreement', 'nda')
    and step.active
  on conflict (partner_id, step_id) do update
  set completed = false, completed_at = null, completed_by = null;

  perform public.record_audit('Agreement Documents Published','Onboarding',null,'Agreement and NDA',null,
    jsonb_build_object('agreement_version',agreement_version,'nda_version',nda_version));
end;
$$;

grant execute on function public.publish_required_agreements(text, text) to authenticated;
