-- Preserve the Admin or Super Admin identity that issues each partner agreement.

alter table public.invitations
  add column if not exists agreement_signer_name text,
  add column if not exists agreement_signer_role public.app_role,
  add column if not exists agreement_signed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invitations_agreement_signer_role_check'
      and conrelid = 'public.invitations'::regclass
  ) then
    alter table public.invitations
      add constraint invitations_agreement_signer_role_check
      check (
        agreement_signer_role is null
        or agreement_signer_role in ('admin', 'super_admin')
      );
  end if;
end;
$$;

update public.invitations invitation
set agreement_signer_name = coalesce(
      nullif(trim(invitation.agreement_signer_name), ''),
      nullif(trim(actor.full_name), ''),
      actor.email::text
    ),
    agreement_signer_role = case
      when actor.role in ('admin', 'super_admin') then actor.role
      else invitation.agreement_signer_role
    end,
    agreement_signed_at = coalesce(invitation.agreement_signed_at, invitation.created_at)
from public.profiles actor
where actor.id = invitation.invited_by
  and (
    invitation.agreement_signer_name is null
    or invitation.agreement_signer_role is null
    or invitation.agreement_signed_at is null
  );

create or replace function public.get_current_partner_agreement_issuer()
returns table (
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
    coalesce(
      nullif(trim(invitation.agreement_signer_name), ''),
      nullif(trim(actor.full_name), ''),
      actor.email::text,
      'GoAccelovate Admin'
    ) as signer_name,
    case
      when coalesce(invitation.agreement_signer_role, actor.role) in ('admin', 'super_admin')
        then coalesce(invitation.agreement_signer_role, actor.role)
      else 'admin'::public.app_role
    end as signer_role,
    coalesce(invitation.agreement_signed_at, invitation.created_at) as signed_at
  from public.invitations invitation
  left join public.profiles actor on actor.id = invitation.invited_by
  where invitation.partner_id = public.current_partner_id()
    and invitation.revoked_at is null
  order by invitation.created_at desc
  limit 1
$$;

revoke all on function public.get_current_partner_agreement_issuer() from public, anon;
grant execute on function public.get_current_partner_agreement_issuer() to authenticated;

comment on function public.get_current_partner_agreement_issuer() is
  'Returns the immutable agreement issuer snapshot only for the signed-in Sales Partner.';
