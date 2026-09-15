do $$
declare
  table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach table_name in array array['leads', 'tasks', 'calendar_events', 'financial_records'] loop
    if to_regclass(format('public.%I', table_name)) is not null
      and not exists (
        select 1
        from pg_publication_tables publication_table
        where publication_table.pubname = 'supabase_realtime'
          and publication_table.schemaname = 'public'
          and publication_table.tablename = table_name
      ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
