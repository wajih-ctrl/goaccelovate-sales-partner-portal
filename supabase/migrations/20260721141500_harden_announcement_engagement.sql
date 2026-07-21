-- Keep announcement engagement identity server-authored and ensure updates remain
-- subject to active-account and audience access rules.

create or replace function public.set_announcement_comment_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actor_id := auth.uid();
  select coalesce(profile.full_name, profile.email::text)
  into new.actor_name
  from public.profiles profile
  where profile.id=auth.uid() and profile.account_status='active';
  if new.actor_name is null then raise exception 'Active portal account required'; end if;
  return new;
end;
$$;

drop trigger if exists announcement_comment_set_actor on public.announcement_comments;
create trigger announcement_comment_set_actor
before insert on public.announcement_comments
for each row execute function public.set_announcement_comment_actor();

revoke all on function public.set_announcement_comment_actor() from public, anon, authenticated;

drop policy if exists announcement_reactions_update_own on public.announcement_reactions;
create policy announcement_reactions_update_own on public.announcement_reactions
for update to authenticated
using (
  actor_id=auth.uid()
  and (
    public.is_admin()
    or (
      public.partner_has_program_access()
      and public.partner_can_read_announcement(announcement_id)
    )
  )
)
with check (
  actor_id=auth.uid()
  and (
    public.is_admin()
    or (
      public.partner_has_program_access()
      and public.partner_can_read_announcement(announcement_id)
    )
  )
);

drop policy if exists announcement_reactions_delete_own on public.announcement_reactions;
create policy announcement_reactions_delete_own on public.announcement_reactions
for delete to authenticated
using (
  actor_id=auth.uid()
  and (
    public.is_admin()
    or (
      public.partner_has_program_access()
      and public.partner_can_read_announcement(announcement_id)
    )
  )
);
