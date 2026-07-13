-- Keep audit records immutable while allowing ON DELETE SET NULL to preserve
-- historical entries after an Auth/profile account is removed.
create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and old.actor_id is not null
    and new.actor_id is null
    and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id')
  then
    return new;
  end if;

  raise exception 'Audit log is append-only';
end;
$$;
