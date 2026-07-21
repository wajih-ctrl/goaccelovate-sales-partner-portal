-- Fix enum coercion in secure lead comments and keep mention notifications isolated.

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
  actor public.profiles;
  lead_row public.leads;
  comment_row public.lead_activity_log;
begin
  select * into actor
  from public.profiles
  where id = auth.uid() and account_status = 'active';

  if actor.id is null then raise exception 'Active portal account required'; end if;

  select * into lead_row from public.leads where id = target_lead;
  if lead_row.id is null then raise exception 'Lead not found'; end if;
  if coalesce(trim(comment_text), '') = '' then raise exception 'Comment cannot be empty'; end if;
  if char_length(trim(comment_text)) > 2000 then
    raise exception 'Comment cannot exceed 2,000 characters';
  end if;

  if actor_role = 'partner' then
    if not public.is_current_partner(lead_row.partner_id) then raise exception 'Lead access denied'; end if;
    if private_comment then raise exception 'Sales Partners cannot create private notes'; end if;
    if exists (
      select 1
      from unnest(coalesce(mentioned_users, '{}'::uuid[])) mentioned(id)
      left join public.profiles profile on profile.id = mentioned.id
      where profile.id is null
        or profile.role not in ('admin', 'super_admin')
        or profile.account_status <> 'active'
    ) then
      raise exception 'Sales Partners may mention only active Admin or Super Admin users';
    end if;
  elsif actor_role not in ('admin', 'super_admin') then
    raise exception 'Comment access denied';
  end if;

  insert into public.lead_activity_log (
    lead_id,
    type,
    actor_id,
    actor_name,
    text,
    is_private
  ) values (
    target_lead,
    (case when private_comment then 'admin_note' else 'comment' end)::public.activity_type,
    actor.id,
    coalesce(nullif(trim(actor.full_name), ''), actor.email::text),
    trim(comment_text),
    private_comment
  )
  returning * into comment_row;

  update public.leads
  set last_activity_at = now(), updated_at = now()
  where id = target_lead;

  if actor_role = 'partner' then
    insert into public.notifications (recipient_id, title, body, type, mandatory)
    select distinct
      profile.id,
      'Mentioned in a lead comment',
      coalesce(nullif(trim(actor.full_name), ''), actor.email::text) ||
        ' mentioned you on ' || lead_row.company_name || ': ' || left(trim(comment_text), 180),
      'info',
      false
    from public.profiles profile
    where profile.id = any(coalesce(mentioned_users, '{}'::uuid[]))
      and profile.id <> actor.id;
  elsif not private_comment then
    insert into public.notifications (partner_id, title, body, type, mandatory)
    values (
      lead_row.partner_id,
      'New lead comment',
      coalesce(nullif(trim(actor.full_name), ''), actor.email::text) ||
        ' commented on ' || lead_row.company_name || ': ' || left(trim(comment_text), 180),
      'info',
      false
    );
  end if;

  return comment_row;
end;
$$;

revoke all on function public.add_lead_comment_secure(uuid, text, boolean, uuid[])
  from public, anon;
grant execute on function public.add_lead_comment_secure(uuid, text, boolean, uuid[])
  to authenticated;
