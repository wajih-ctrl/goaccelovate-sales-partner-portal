-- Lead owners may mention active portal staff even while onboarding state is refreshing.
-- Ownership remains mandatory and only staff display details are returned.

create or replace function public.get_lead_mention_candidates(target_lead uuid)
returns table (
  id uuid,
  display_name text,
  role public.app_role,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  with accessible_lead as (
    select lead.id
    from public.leads lead
    where lead.id = target_lead
      and (
        public.is_admin()
        or public.is_current_partner(lead.partner_id)
      )
  )
  select
    profile.id,
    coalesce(nullif(trim(profile.full_name), ''), 'GoAccelovate Admin') as display_name,
    profile.role,
    profile.avatar_url
  from accessible_lead
  join public.profiles profile
    on profile.role in ('admin', 'super_admin')
   and profile.account_status = 'active'
   and profile.id <> auth.uid()
  order by
    case profile.role when 'super_admin' then 0 else 1 end,
    display_name;
$$;

revoke all on function public.get_lead_mention_candidates(uuid)
  from public, anon;
grant execute on function public.get_lead_mention_candidates(uuid)
  to authenticated;
