create table public.operational_alarms (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  source_type text not null check (source_type in (
    'LEAD', 'TASK', 'CALENDAR_EVENT', 'FINANCIAL_RECORD',
    'CALENDAR_INTEGRATION', 'OFFICE', 'SUPPORT_REQUEST'
  )),
  source_id uuid,
  rule_code text not null,
  cycle_key text not null,
  severity text not null check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  state text not null default 'OPEN' check (state in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELED')),
  assigned_user_id uuid references public.profiles(id) on delete set null,
  title text not null check (length(title) between 1 and 160),
  message text not null default '' check (length(message) <= 2000),
  action_path text check (action_path is null or action_path like '/%'),
  base_at timestamptz,
  due_at timestamptz,
  triggered_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_code text,
  resolved_automatically boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  rule_version integer not null default 1 check (rule_version > 0),
  version integer not null default 1 check (version > 0),
  last_evaluated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index operational_alarms_one_open_cycle_idx
  on public.operational_alarms (office_id, source_type, source_id, rule_code, cycle_key)
  where state in ('OPEN', 'ACKNOWLEDGED');

create index operational_alarms_office_queue_idx
  on public.operational_alarms (office_id, state, severity, due_at);

create index operational_alarms_assigned_queue_idx
  on public.operational_alarms (assigned_user_id, state, severity, due_at);

create index operational_alarms_source_idx
  on public.operational_alarms (source_type, source_id);

create index operational_alarms_office_triggered_idx
  on public.operational_alarms (office_id, triggered_at desc);

create table public.operational_alarm_events (
  id uuid primary key default gen_random_uuid(),
  alarm_id uuid not null references public.operational_alarms(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  event_type text not null check (event_type in ('CREATED', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELED', 'REOPENED', 'EVALUATED')),
  from_state text,
  to_state text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  reason text check (reason is null or length(reason) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index operational_alarm_events_alarm_idx
  on public.operational_alarm_events (alarm_id, created_at desc);

create index operational_alarm_events_office_idx
  on public.operational_alarm_events (office_id, created_at desc);

create table public.operational_alarm_recipients (
  alarm_id uuid not null references public.operational_alarms(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivery_reason text not null check (delivery_reason in ('ASSIGNEE', 'OWNER', 'ADMIN', 'FINANCE', 'FALLBACK')),
  read_at timestamptz,
  snoozed_until timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (alarm_id, user_id)
);

create index operational_alarm_recipients_user_queue_idx
  on public.operational_alarm_recipients (user_id, office_id, dismissed_at, snoozed_until);

create index operational_alarm_recipients_office_idx
  on public.operational_alarm_recipients (office_id, user_id, alarm_id);

create trigger operational_alarms_set_updated_at
  before update on public.operational_alarms
  for each row execute function public.set_updated_at();

create trigger operational_alarm_recipients_set_updated_at
  before update on public.operational_alarm_recipients
  for each row execute function public.set_updated_at();

alter table public.operational_alarms enable row level security;
alter table public.operational_alarm_events enable row level security;
alter table public.operational_alarm_recipients enable row level security;

create policy operational_alarms_recipient_read
  on public.operational_alarms for select to authenticated
  using (
    exists (
      select 1
        from public.operational_alarm_recipients recipient
       where recipient.alarm_id = operational_alarms.id
         and recipient.office_id = operational_alarms.office_id
         and recipient.user_id = auth.uid()
    )
    and public.is_office_member(operational_alarms.office_id)
  );

create policy operational_alarm_events_recipient_read
  on public.operational_alarm_events for select to authenticated
  using (
    exists (
      select 1
        from public.operational_alarm_recipients recipient
       where recipient.alarm_id = operational_alarm_events.alarm_id
         and recipient.office_id = operational_alarm_events.office_id
         and recipient.user_id = auth.uid()
    )
    and public.is_office_member(operational_alarm_events.office_id)
  );

create policy operational_alarm_recipients_self_read
  on public.operational_alarm_recipients for select to authenticated
  using (user_id = auth.uid() and public.is_office_member(office_id));

-- No INSERT/UPDATE/DELETE policies are intentional. Service-role/internal RPCs
-- are the only writers for alarm state, history and recipient materialization.
