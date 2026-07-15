-- Archived partner profiles retain financial history, but must not block a new
-- invitation for the same email address.

alter table public.partner_profiles
  drop constraint if exists partner_profiles_email_key;

create unique index if not exists partner_profiles_active_email_key
  on public.partner_profiles (email)
  where deleted_at is null;
