-- Keep payout completion visible in already-open Admin and Partner sessions.
-- Realtime applies each subscriber's existing RLS select policies.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'payout_requests',
    'payout_request_items',
    'commissions',
    'notifications'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end
$$;
