alter table public.tasks
  add column if not exists responsible_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.lead_events
  add column if not exists from_status text,
  add column if not exists to_status text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists tasks_office_responsible_due_idx
  on public.tasks (office_id, responsible_user_id, done, due_at);

create index if not exists lead_events_office_status_idx
  on public.lead_events (office_id, lead_id, type, created_at desc);
