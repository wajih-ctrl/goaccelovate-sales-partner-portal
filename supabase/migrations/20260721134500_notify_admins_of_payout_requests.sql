-- Admins need awareness of payout requests even though only Super Admins may
-- approve, reject, or record their external payment.

create or replace function public.notify_admins_of_new_payout_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(recipient_id,title,body,type,mandatory)
  select profile.id,
    'New payout request',
    'A Sales Partner requested a payout of ' || new.amount ||
      coalesce(' via ' || nullif(new.preferred_payment_method, ''), '') || '.',
    'info',
    true
  from public.profiles profile
  where profile.role='admin'
    and profile.account_status='active'
    and profile.id<>new.requested_by;
  return new;
end;
$$;

drop trigger if exists payout_request_notify_admins on public.payout_requests;
create trigger payout_request_notify_admins
after insert on public.payout_requests
for each row execute function public.notify_admins_of_new_payout_request();

revoke all on function public.notify_admins_of_new_payout_request() from public, anon, authenticated;
