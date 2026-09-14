-- The outbox row references calendar_events(id), so it must only be written
-- after the parent event exists. Keep row metadata in a BEFORE trigger and
-- enqueue the durable sync operation in a separate AFTER trigger.

create or replace function public.prepare_calendar_event_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_name text := coalesce(current_setting('app.calendar_sync_source', true), 'local');
begin
  if source_name = 'remote' then
    return new;
  end if;

  new.sync_version := case
    when tg_op = 'INSERT' then 1
    else coalesce(old.sync_version, 0) + 1
  end;
  new.last_local_change_at := timezone('utc', now());
  return new;
end;
$$;

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
    office_id,
    calendar_event_id,
    operation,
    status,
    available_at,
    version
  )
  values (
    new.office_id,
    new.id,
    operation_name,
    'pending',
    timezone('utc', now()),
    new.sync_version
  )
  on conflict (calendar_event_id, operation) where status in ('pending', 'processing')
  do update set
    status = 'pending',
    available_at = timezone('utc', now()),
    version = excluded.version,
    last_error = null,
    dead_lettered_at = null;

  return new;
end;
$$;

drop trigger if exists calendar_events_enqueue_sync on public.calendar_events;
drop trigger if exists calendar_events_prepare_sync on public.calendar_events;

create trigger calendar_events_prepare_sync
  before insert or update of title, type, status, start_at, end_at, location, notes, lead_id,
    responsible_user_id, attendees, deleted_at on public.calendar_events
  for each row execute function public.prepare_calendar_event_sync();

create trigger calendar_events_enqueue_sync
  after insert or update of title, type, status, start_at, end_at, location, notes, lead_id,
    responsible_user_id, attendees, deleted_at on public.calendar_events
  for each row execute function public.enqueue_calendar_sync();

