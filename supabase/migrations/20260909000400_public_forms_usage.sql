create table public.public_forms (
  slug text primary key,
  office_id uuid not null references public.offices(id) on delete cascade,
  office_name text not null default '',
  lawyer_name text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  city text not null default '',
  state text not null default '',
  areas jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.usage_counters (
  office_id uuid primary key references public.offices(id) on delete cascade,
  users integer not null default 0,
  contacts integer not null default 0,
  storage_bytes bigint not null default 0,
  storage_reserved_bytes bigint not null default 0,
  refreshed_at timestamptz not null default timezone('utc', now())
);

create index public_forms_office_idx on public.public_forms (office_id);
alter table public.public_forms enable row level security;
alter table public.usage_counters enable row level security;

create policy public_forms_member_read on public.public_forms for select to authenticated using (public.is_office_member(office_id));
create policy public_forms_manager_write on public.public_forms for all to authenticated using (public.has_office_role(office_id, array['owner', 'admin'])) with check (public.has_office_role(office_id, array['owner', 'admin']));
create policy usage_member_read on public.usage_counters for select to authenticated using (public.is_office_member(office_id));
