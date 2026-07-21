-- Keep announcement engagement and attachments behind the same signed-agreement
-- access gate as the announcement feed itself.

insert into public.settings (key, value, description)
values (
  'welcome_intro_video_url',
  '"https://www.youtube.com/@GoAccelovate"'::jsonb,
  'Welcome Kit introduction video URL; update when the final VP video URL is confirmed'
)
on conflict (key) do nothing;

drop policy if exists announcement_comments_select on public.announcement_comments;
create policy announcement_comments_select on public.announcement_comments
for select to authenticated
using (
  public.is_admin()
  or (
    public.partner_has_program_access()
    and public.partner_can_read_announcement(announcement_id)
  )
);

drop policy if exists announcement_comments_insert on public.announcement_comments;
create policy announcement_comments_insert on public.announcement_comments
for insert to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.account_status = 'active'
  )
  and (
    public.is_admin()
    or (
      public.partner_has_program_access()
      and public.partner_can_read_announcement(announcement_id)
    )
  )
);

drop policy if exists announcement_reactions_select on public.announcement_reactions;
create policy announcement_reactions_select on public.announcement_reactions
for select to authenticated
using (
  public.is_admin()
  or (
    public.partner_has_program_access()
    and public.partner_can_read_announcement(announcement_id)
  )
);

drop policy if exists announcement_reactions_insert on public.announcement_reactions;
create policy announcement_reactions_insert on public.announcement_reactions
for insert to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.account_status = 'active'
  )
  and (
    public.is_admin()
    or (
      public.partner_has_program_access()
      and public.partner_can_read_announcement(announcement_id)
    )
  )
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
      and (
        public.is_admin()
        or (
          public.partner_has_program_access()
          and public.partner_can_read_announcement(announcement.id)
        )
      )
  )
);
