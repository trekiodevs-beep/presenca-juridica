-- Contrato completo de sincronização bidirecional do calendário.
-- A integração externa permanece fora da transação do CRM; esta migration
-- apenas torna o estado durável, auditável e seguro para reprocessamento.

alter table public.calendar_events
  add column if not exists origin text not null default 'crm',
  add column if not exists google_etag text,
  add column if not exists google_updated_at timestamptz,
  add column if not exists last_local_change_at timestamptz,
  add column if not exists last_remote_change_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists sync_version bigint not null default 1,
  add column if not exists attendees jsonb not null default '[]'::jsonb;

alter table public.calendar_events drop constraint if exists calendar_events_sync_status_check;
alter table public.calendar_events add constraint calendar_events_sync_status_check
  check (sync_status in ('not_connected', 'pending', 'processing', 'synced', 'failed', 'cancelled', 'conflict', 'deleted_external'));
alter table public.calendar_events drop constraint if exists calendar_events_origin_check;
alter table public.calendar_events add constraint calendar_events_origin_check
  check (origin in ('crm', 'google', 'linked'));
alter table public.calendar_events add constraint calendar_events_attendees_array_check
  check (jsonb_typeof(attendees) = 'array');

alter table public.calendar_connections
  add column if not exists calendar_sync_token text,
  add column if not exists calendar_sync_token_updated_at timestamptz,
  add column if not exists last_remote_sync_at timestamptz,
  add column if not exists sync_enabled boolean not null default true,
  add column if not exists connection_version bigint not null default 1,
  add column if not exists webhook_channel_id text,
  add column if not exists webhook_resource_id text,
  add column if not exists webhook_expires_at timestamptz;
create unique index if not exists calendar_connections_webhook_channel_idx
  on public.calendar_connections (webhook_channel_id) where webhook_channel_id is not null;

alter table public.calendar_sync_outbox
  add column if not exists version bigint not null default 1,
  add column if not exists dead_lettered_at timestamptz;
alter table public.calendar_sync_outbox drop constraint if exists calendar_sync_outbox_operation_check;
alter table public.calendar_sync_outbox add constraint calendar_sync_outbox_operation_check
  check (operation in ('upsert', 'delete', 'reconcile'));

create table if not exists public.calendar_event_snapshots (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  calendar_event_id uuid not null references public.calendar_events(id) on delete cascade,
  source text not null check (source in ('crm', 'google')),
  payload jsonb not null,
  etag text,
  captured_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.calendar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  mode text not null check (mode in ('manual', 'scheduled', 'webhook')),
  status text not null default 'running' check (status in ('running', 'completed', 'partial', 'failed')),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  sent_count integer not null default 0,
  received_count integer not null default 0,
  updated_count integer not null default 0,
  deleted_count integer not null default 0,
  conflict_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary text
);

create index if not exists calendar_events_external_lookup_idx
  on public.calendar_events (office_id, external_provider, external_calendar_id, external_event_id);
create index if not exists calendar_events_conflict_idx
  on public.calendar_events (office_id, sync_status) where sync_status in ('conflict', 'failed');
create index if not exists calendar_snapshots_event_captured_idx
  on public.calendar_event_snapshots (calendar_event_id, captured_at desc);
create index if not exists calendar_runs_office_started_idx
  on public.calendar_sync_runs (office_id, started_at desc);

alter table public.calendar_event_snapshots enable row level security;
alter table public.calendar_sync_runs enable row level security;
create policy calendar_event_snapshots_member_read on public.calendar_event_snapshots
  for select to authenticated using (public.is_office_member(office_id));
create policy calendar_sync_runs_member_read on public.calendar_sync_runs
  for select to authenticated using (public.is_office_member(office_id));
revoke all on public.calendar_event_snapshots, public.calendar_sync_runs from anon, authenticated;
grant select on public.calendar_event_snapshots, public.calendar_sync_runs to authenticated;

create or replace function public.calendar_event_payload(target public.calendar_events)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'title', target.title, 'type', target.type, 'status', target.status,
    'startAt', target.start_at, 'endAt', target.end_at, 'location', target.location,
    'notes', target.notes, 'leadId', target.lead_id, 'responsibleUserId', target.responsible_user_id,
    'attendees', target.attendees
  )
$$;

create or replace function public.enqueue_calendar_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  operation_name text := case when new.deleted_at is not null then 'delete' else 'upsert' end;
  source_name text := coalesce(current_setting('app.calendar_sync_source', true), 'local');
begin
  new.sync_version := case when tg_op = 'INSERT' then 1 else coalesce(old.sync_version, 0) + 1 end;
  if source_name = 'remote' then
    return new;
  end if;
  new.last_local_change_at := timezone('utc', now());
  update public.calendar_sync_outbox
     set status = 'completed', locked_at = null, last_error = 'Substituída por nova operação.'
   where calendar_event_id = new.id and operation <> operation_name and status in ('pending', 'processing');
  insert into public.calendar_sync_outbox (office_id, calendar_event_id, operation, status, available_at, version)
  values (new.office_id, new.id, operation_name, 'pending', timezone('utc', now()), new.sync_version)
  on conflict (calendar_event_id, operation) where status in ('pending', 'processing')
  do update set status = 'pending', available_at = timezone('utc', now()), version = excluded.version,
                last_error = null, dead_lettered_at = null;
  return new;
end;
$$;

drop trigger if exists calendar_events_enqueue_sync on public.calendar_events;
create trigger calendar_events_enqueue_sync
  before insert or update of title, type, status, start_at, end_at, location, notes, lead_id,
    responsible_user_id, attendees, deleted_at on public.calendar_events
  for each row execute function public.enqueue_calendar_sync();

create or replace function public.mark_calendar_event_deleted(target_event_id uuid)
returns public.calendar_events language plpgsql security definer set search_path = public as $$
declare result public.calendar_events;
begin
  update public.calendar_events set deleted_at = coalesce(deleted_at, timezone('utc', now())),
    sync_status = 'pending' where id = target_event_id
    and public.is_office_member(office_id)
  returning * into result;
  if result.id is null then raise exception 'Evento não encontrado ou não autorizado'; end if;
  insert into public.audit_logs (office_id, actor_user_id, action, target_type, target_id, metadata)
  values (result.office_id, auth.uid(), 'calendar_event_deleted', 'calendar_event', result.id,
    jsonb_build_object('origin', result.origin));
  return result;
end;
$$;
grant execute on function public.mark_calendar_event_deleted(uuid) to authenticated;

create or replace function public.set_calendar_remote_state(
  target_event_id uuid, remote_payload jsonb, remote_etag text, remote_updated_at timestamptz,
  remote_deleted boolean default false
) returns public.calendar_events language plpgsql security definer set search_path = public as $$
declare result public.calendar_events;
begin
  set local app.calendar_sync_source = 'remote';
  update public.calendar_events set
    title = coalesce(remote_payload->>'title', title),
    start_at = coalesce((remote_payload->>'startAt')::timestamptz, start_at),
    end_at = case when remote_payload ? 'endAt' then (remote_payload->>'endAt')::timestamptz else end_at end,
    location = nullif(remote_payload->>'location', ''), notes = nullif(remote_payload->>'notes', ''),
    attendees = coalesce(remote_payload->'attendees', attendees), google_etag = remote_etag,
    google_updated_at = remote_updated_at, last_remote_change_at = timezone('utc', now()),
    deleted_at = case when remote_deleted then coalesce(deleted_at, timezone('utc', now())) else null end,
    sync_status = case when remote_deleted then 'deleted_external' else 'synced' end
  where id = target_event_id returning * into result;
  return result;
end;
$$;
revoke all on function public.set_calendar_remote_state(uuid, jsonb, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.set_calendar_remote_state(uuid, jsonb, text, timestamptz, boolean) to service_role;

create or replace function public.create_calendar_remote_event(
  target_office_id uuid, target_calendar_id text, target_external_id text,
  remote_payload jsonb, remote_etag text, remote_updated_at timestamptz
) returns public.calendar_events language plpgsql security definer set search_path = public as $$
declare result public.calendar_events;
begin
  set local app.calendar_sync_source = 'remote';
  insert into public.calendar_events (office_id, title, type, status, start_at, end_at, location, notes,
    attendees, origin, external_provider, external_calendar_id, external_event_id, google_etag,
    google_updated_at, last_remote_change_at, sync_status)
  values (target_office_id, coalesce(remote_payload->>'title', 'Evento Google'),
    coalesce(remote_payload->>'type', 'Outro'), coalesce(remote_payload->>'status', 'Agendado'),
    (remote_payload->>'startAt')::timestamptz, (remote_payload->>'endAt')::timestamptz,
    nullif(remote_payload->>'location', ''), nullif(remote_payload->>'notes', ''),
    coalesce(remote_payload->'attendees', '[]'::jsonb), 'google', 'google', target_calendar_id,
    target_external_id, remote_etag, remote_updated_at, timezone('utc', now()), 'synced')
  returning * into result;
  return result;
end;
$$;
revoke all on function public.create_calendar_remote_event(uuid, text, text, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_calendar_remote_event(uuid, text, text, jsonb, text, timestamptz) to service_role;
