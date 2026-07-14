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
    and account_status not in ('suspended', 'deactivated')
  returning * into profile;

  if profile.id is null then
    raise exception 'Profile cannot be activated';
  end if;

  update public.partner_profiles
  set status = 'active'
  where id = profile.partner_id and status = 'pending';

  update public.invitations
  set accepted_at = now()
  where lower(email::text) = lower(profile.email::text)
    and accepted_at is null
    and revoked_at is null;

  perform public.record_audit(
    'Invitation Accepted',
    'Users',
    profile.id::text,
    profile.full_name,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'active')
  );

  return profile;
end;
$$;

grant execute on function public.activate_current_profile(text) to authenticated;

-- Backfill invitations already accepted before accepted_at was maintained.
update public.invitations invitation
set accepted_at = coalesce(profile.updated_at, now())
from public.profiles profile
where lower(invitation.email::text) = lower(profile.email::text)
  and profile.account_status = 'active'
  and invitation.accepted_at is null
  and invitation.revoked_at is null;

update public.partner_profiles partner
set status = 'active'
from public.profiles profile
where profile.partner_id = partner.id
  and profile.account_status = 'active'
  and partner.status = 'pending';

do $$
declare
  agreement_version integer;
  nda_version integer;
begin
  select coalesce(max(version), 0) + 1
  into agreement_version
  from public.agreement_documents
  where document_type = 'Agreement';

  select coalesce(max(version), 0) + 1
  into nda_version
  from public.agreement_documents
  where document_type = 'NDA';

  update public.agreement_documents set is_active = false where is_active;

  insert into public.agreement_documents (
    document_type, title, version, content_url, content_hash, is_active
  )
  values
    (
      'Agreement',
      'Strategic Referral Partnership Agreement',
      agreement_version,
      '/legal/agreement',
      'portal-template-2026-07-14',
      true
    ),
    (
      'NDA',
      'Non-Disclosure Agreement',
      nda_version,
      '/legal/nda',
      'portal-template-2026-07-14',
      true
    );
end;
$$;
