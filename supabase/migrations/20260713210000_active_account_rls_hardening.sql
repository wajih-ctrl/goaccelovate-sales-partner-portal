create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid() and account_status = 'active'
$$;

create or replace function public.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_id
  from public.profiles
  where id = auth.uid() and account_status = 'active'
$$;

comment on function public.current_user_role() is
  'Returns a role only for active accounts so suspended and deactivated sessions fail RLS checks.';

comment on function public.current_partner_id() is
  'Returns a partner link only for active accounts so suspended and deactivated sessions fail RLS checks.';
