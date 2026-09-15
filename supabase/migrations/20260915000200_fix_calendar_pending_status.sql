-- The AFTER trigger introduced to preserve the calendar event foreign key
-- enqueues correctly, but it must also expose the durable queue state on the
-- source event. Updating sync_status does not recurse because that column is
-- intentionally absent from the trigger's UPDATE OF list.

create or replace function public.enqueue_calendar_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  operation_name text := case when new.deleted_at is not null then 'delete' else 'upsert' end;
  source_name text := coalesce(current_setting('app.calendar_sync_source', true), 'local');
begin
  if source_name = 'remote' then
    return new;
  end if;

  update public.calendar_sync_outbox
     set status = 'completed', locked_at = null, last_error = 'Substituída por nova operação.'
   where calendar_event_id = new.id
     and operation <> operation_name
     and status in ('pending', 'processing');

  insert into public.calendar_sync_outbox (
    office_id, calendar_event_id, operation, status, available_at, version
  ) values (
    new.office_id, new.id, operation_name, 'pending', timezone('utc', now()), new.sync_version
  )
  on conflict (calendar_event_id, operation) where status in ('pending', 'processing')
  do update set
    status = 'pending',
    available_at = timezone('utc', now()),
    version = excluded.version,
    last_error = null,
    dead_lettered_at = null;

  update public.calendar_events
     set sync_status = 'pending', sync_error = null
   where id = new.id
     and (sync_status is distinct from 'pending' or sync_error is not null);

  return new;
end;
$$;
