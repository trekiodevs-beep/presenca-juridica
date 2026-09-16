-- CRM-only relationships must not create outbound Google Calendar writes.
-- Shared event fields still enqueue an upsert; inserts always enqueue once.

drop trigger if exists calendar_events_prepare_sync on public.calendar_events;
drop trigger if exists calendar_events_enqueue_sync on public.calendar_events;

create trigger calendar_events_prepare_sync
  before insert or update of title, start_at, end_at, location, notes, attendees, deleted_at
  on public.calendar_events
  for each row execute function public.prepare_calendar_event_sync();

create trigger calendar_events_enqueue_sync
  after insert or update of title, start_at, end_at, location, notes, attendees, deleted_at
  on public.calendar_events
  for each row execute function public.enqueue_calendar_sync();

comment on column public.calendar_events.lead_id is
  'CRM-only contact relationship. Never exported to Google Calendar.';
