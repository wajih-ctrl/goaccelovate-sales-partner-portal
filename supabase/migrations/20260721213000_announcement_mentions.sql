-- Add secure, audience-aware mentions to announcement conversations.

alter table public.announcement_comments
  add column if not exists mentioned_user_ids uuid[] not null default '{}'::uuid[];

create or replace function public.get_announcement_mention_candidates(target_announcement uuid)
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
  with target as (
    select announcement.*
    from public.announcements announcement
    where announcement.id = target_announcement
      and announcement.archived_at is null
      and (
        public.is_admin()
        or (
          public.partner_has_program_access()
          and public.partner_can_read_announcement(announcement.id)
        )
      )
  )
  select
    profile.id,
    coalesce(nullif(trim(profile.full_name), ''), profile.email::text) as display_name,
    profile.role,
    profile.avatar_url
  from target
  join public.profiles profile
    on profile.account_status = 'active'
   and profile.id <> auth.uid()
  left join public.partner_profiles partner on partner.id = profile.partner_id
  where
    profile.role in ('admin', 'super_admin')
    or (
      public.is_admin()
      and profile.role = 'partner'
      and partner.status = 'active'
      and (
        target.target_type in ('all_users', 'all_partners')
        or (
          target.target_type = 'selected_partners'
          and target.target_rules -> 'partner_ids' ? partner.id::text
        )
      )
    )
  order by
    case profile.role when 'super_admin' then 0 when 'admin' then 1 else 2 end,
    display_name;
$$;

revoke all on function public.get_announcement_mention_candidates(uuid)
  from public, anon;
grant execute on function public.get_announcement_mention_candidates(uuid)
  to authenticated;

create or replace function public.add_announcement_comment_secure(
  target_announcement uuid,
  comment_body text,
  mentioned_users uuid[] default '{}'::uuid[]
)
returns public.announcement_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  announcement public.announcements;
  allowed_mentions uuid[];
  saved_comment public.announcement_comments;
begin
  if char_length(trim(comment_body)) not between 1 and 2000 then
    raise exception 'Comment must contain between 1 and 2000 characters';
  end if;

  select * into actor
  from public.profiles
  where id = auth.uid() and account_status = 'active';

  if actor.id is null then raise exception 'Active portal account required'; end if;

  select target.* into announcement
  from public.announcements target
  where target.id = target_announcement
    and target.archived_at is null
    and (
      public.is_admin()
      or (
        public.partner_has_program_access()
        and public.partner_can_read_announcement(target.id)
      )
    );

  if announcement.id is null then raise exception 'Announcement is not available'; end if;

  select coalesce(array_agg(candidate.id), '{}'::uuid[])
  into allowed_mentions
  from public.get_announcement_mention_candidates(target_announcement) candidate
  where candidate.id = any(coalesce(mentioned_users, '{}'::uuid[]));

  insert into public.announcement_comments (
    announcement_id,
    actor_id,
    actor_name,
    body,
    mentioned_user_ids
  )
  values (
    target_announcement,
    actor.id,
    coalesce(nullif(trim(actor.full_name), ''), actor.email::text),
    trim(comment_body),
    allowed_mentions
  )
  returning * into saved_comment;

  insert into public.notifications (recipient_id, title, body, type, mandatory)
  select
    mentioned_id,
    'Mentioned in an announcement',
    coalesce(nullif(trim(actor.full_name), ''), actor.email::text) ||
      ' mentioned you in "' || announcement.title || '": ' || left(trim(comment_body), 180),
    'info',
    false
  from unnest(allowed_mentions) mentioned_id
  where mentioned_id <> actor.id;

  if announcement.published_by is not null
    and announcement.published_by <> actor.id
    and not (announcement.published_by = any(allowed_mentions)) then
    insert into public.notifications (recipient_id, title, body, type, mandatory)
    values (
      announcement.published_by,
      'New announcement reply',
      coalesce(nullif(trim(actor.full_name), ''), actor.email::text) ||
        ' replied to "' || announcement.title || '": ' || left(trim(comment_body), 180),
      'info',
      false
    );
  end if;

  return saved_comment;
end;
$$;

revoke insert on public.announcement_comments from authenticated;
revoke all on function public.add_announcement_comment_secure(uuid, text, uuid[])
  from public, anon;
grant execute on function public.add_announcement_comment_secure(uuid, text, uuid[])
  to authenticated;
