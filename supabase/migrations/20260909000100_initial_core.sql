create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  photo_url text,
  global_role text check (global_role in ('platform_admin')),
  accepted_terms_version text,
  accepted_terms_at timestamptz,
  accepted_privacy_version text,
  accepted_privacy_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lawyer_name text not null default '',
  oab text not null default '',
  city text not null default '',
  state text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  areas jsonb not null default '[]'::jsonb,
  slug text unique,
  subscription_status text not null default 'TRIALING',
  plan_code text not null default 'trial',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_ends_at_ms bigint,
  grace_ends_at timestamptz,
  grace_ends_at_ms bigint,
  owner_user_id uuid not null references public.profiles(id),
  onboarding_completed_at timestamptz,
  limits jsonb not null default '{}'::jsonb,
  deletion_scheduled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  name text not null default '',
  role text not null default 'assistant' check (role in ('owner', 'admin', 'lawyer', 'assistant', 'finance', 'read')),
  status text not null default 'invited' check (status in ('active', 'invited', 'blocked', 'removed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (office_id, user_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  name text not null,
  phone text not null,
  email text not null default '',
  city text not null default '',
  state text not null default '',
  source text not null default 'Cadastro Manual',
  area text not null default 'Outro',
  status text not null default 'Novo contato',
  priority text not null default 'Média',
  responsible_user_id uuid references public.profiles(id) on delete set null,
  summary text not null default '',
  notes text not null default '',
  consent_lgpd boolean not null default false,
  next_action_text text,
  next_action_at timestamptz,
  last_whatsapp_click_at timestamptz,
  archived_at timestamptz,
  created_via text,
  public_form_slug text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  portal_access_enabled boolean not null default false,
  portal_status_label text,
  portal_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null,
  description text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  done boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  title text not null,
  type text not null default 'Outro',
  status text not null default 'Agendado',
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  notes text,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  external_provider text check (external_provider in ('google')),
  external_calendar_id text,
  external_event_id text,
  sync_status text not null default 'not_connected' check (sync_status in ('not_connected', 'pending', 'processing', 'synced', 'failed', 'cancelled')),
  sync_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (external_provider, external_calendar_id, external_event_id)
);

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  google_account_email text not null,
  calendar_id text,
  calendar_name text,
  encrypted_refresh_token text not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked', 'error', 'disconnected')),
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (office_id, user_id, provider)
);

create table public.calendar_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  calendar_event_id uuid not null references public.calendar_events(id) on delete cascade,
  operation text not null check (operation in ('upsert', 'delete')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references public.offices(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index memberships_user_office_idx on public.memberships (user_id, office_id);
create index leads_office_updated_idx on public.leads (office_id, updated_at desc);
create index lead_events_office_lead_idx on public.lead_events (office_id, lead_id, created_at desc);
create index tasks_office_due_idx on public.tasks (office_id, due_at);
create index calendar_events_office_start_idx on public.calendar_events (office_id, start_at);
create index calendar_sync_outbox_pending_idx on public.calendar_sync_outbox (status, available_at);
create index audit_logs_office_created_idx on public.audit_logs (office_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger offices_set_updated_at before update on public.offices for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger calendar_events_set_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();
create trigger calendar_connections_set_updated_at before update on public.calendar_connections for each row execute function public.set_updated_at();
create trigger calendar_sync_outbox_set_updated_at before update on public.calendar_sync_outbox for each row execute function public.set_updated_at();

create or replace function public.is_office_member(target_office_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where office_id = target_office_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_office_role(target_office_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where office_id = target_office_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.offices enable row level security;
alter table public.memberships enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_sync_outbox enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy offices_member_read on public.offices for select to authenticated using (public.is_office_member(id));
create policy offices_manager_update on public.offices for update to authenticated using (public.has_office_role(id, array['owner', 'admin'])) with check (public.has_office_role(id, array['owner', 'admin']));

create policy memberships_member_read on public.memberships for select to authenticated using (public.is_office_member(office_id) or user_id = auth.uid());
create policy memberships_manager_write on public.memberships for all to authenticated using (public.has_office_role(office_id, array['owner', 'admin'])) with check (public.has_office_role(office_id, array['owner', 'admin']));

create policy leads_member_read on public.leads for select to authenticated using (public.is_office_member(office_id));
create policy leads_operator_write on public.leads for all to authenticated using (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant'])) with check (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant']));

create policy lead_events_member_read on public.lead_events for select to authenticated using (public.is_office_member(office_id));
create policy lead_events_operator_write on public.lead_events for insert to authenticated with check (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant']));

create policy tasks_member_read on public.tasks for select to authenticated using (public.is_office_member(office_id));
create policy tasks_operator_write on public.tasks for all to authenticated using (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant'])) with check (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant']));

create policy calendar_events_member_read on public.calendar_events for select to authenticated using (public.is_office_member(office_id));
create policy calendar_events_operator_write on public.calendar_events for all to authenticated using (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant'])) with check (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant']));

create policy calendar_connections_no_client_access on public.calendar_connections for all to authenticated using (false) with check (false);
create policy calendar_sync_outbox_no_client_access on public.calendar_sync_outbox for all to authenticated using (false) with check (false);
create policy audit_logs_member_read on public.audit_logs for select to authenticated using (public.is_office_member(office_id));

grant execute on function public.is_office_member(uuid) to authenticated;
grant execute on function public.has_office_role(uuid, text[]) to authenticated;
