create unique index if not exists calendar_sync_outbox_open_event_idx
  on public.calendar_sync_outbox (calendar_event_id, operation)
  where status in ('pending', 'processing');

create or replace function public.enqueue_calendar_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.calendar_sync_outbox (office_id, calendar_event_id, operation, status, available_at)
  values (new.office_id, new.id, 'upsert', 'pending', timezone('utc', now()))
  on conflict (calendar_event_id, operation) where status in ('pending', 'processing')
  do update set status = 'pending', available_at = timezone('utc', now()), last_error = null;
  update public.calendar_events
     set sync_status = 'pending', sync_error = null
   where id = new.id and sync_status <> 'pending';
  return new;
end;
$$;

drop trigger if exists calendar_events_enqueue_sync on public.calendar_events;
create trigger calendar_events_enqueue_sync
  after insert or update of title, type, status, start_at, end_at, location, notes, lead_id, responsible_user_id
  on public.calendar_events
  for each row execute function public.enqueue_calendar_sync();

create or replace function public.claim_calendar_sync_outbox(batch_size integer default 25)
returns setof public.calendar_sync_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
      from public.calendar_sync_outbox
     where status = 'pending'
       and available_at <= timezone('utc', now())
     order by available_at, created_at
     for update skip locked
     limit greatest(1, least(batch_size, 100))
  )
  update public.calendar_sync_outbox item
     set status = 'processing', locked_at = timezone('utc', now()), attempts = item.attempts + 1
    from candidates
   where item.id = candidates.id
  returning item.*;
end;
$$;

revoke all on function public.claim_calendar_sync_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_calendar_sync_outbox(integer) to service_role;

create or replace function public.enqueue_calendar_sync_for_office(target_office_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued integer;
begin
  insert into public.calendar_sync_outbox (office_id, calendar_event_id, operation, status, available_at)
  select office_id, id, 'upsert', 'pending', timezone('utc', now())
    from public.calendar_events
   where office_id = target_office_id
     and sync_status <> 'synced'
  on conflict do nothing;
  get diagnostics queued = row_count;
  return queued;
end;
$$;

revoke all on function public.enqueue_calendar_sync_for_office(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_calendar_sync_for_office(uuid) to service_role;
