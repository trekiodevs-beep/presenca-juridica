do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'operational_alarms') then
    execute 'alter publication supabase_realtime add table public.operational_alarms';
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'operational_alarm_recipients') then
    execute 'alter publication supabase_realtime add table public.operational_alarm_recipients';
  end if;
end $$;
