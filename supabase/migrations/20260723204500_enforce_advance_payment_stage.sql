-- Advance payments belong only to the Advance Confirmed milestone. Returning a
-- deal to that milestone starts a new payment cycle when an advance was already
-- recorded, allowing a new advance without exposing it at downstream stages.
create or replace function public.enforce_client_payment_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_stage text;
begin
  select stage::text
  into lead_stage
  from public.leads
  where id = new.lead_id;

  if lead_stage is null then
    raise exception 'Lead not found';
  end if;

  if new.payment_type = 'Advance' and lead_stage <> 'Advance Confirmed' then
    raise exception 'Advance payments can only be recorded at Advance Confirmed';
  end if;

  if new.payment_type = 'Final'
     and lead_stage not in ('Final Payment Clearance', 'Final Handoff', 'Closed Won') then
    raise exception 'Final payments can only be recorded from Final Payment Clearance onward';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_client_payment_stage_trigger on public.client_payments;
create trigger enforce_client_payment_stage_trigger
before insert or update of lead_id, payment_type
on public.client_payments
for each row execute function public.enforce_client_payment_stage();

revoke all on function public.enforce_client_payment_stage() from public, anon, authenticated;
