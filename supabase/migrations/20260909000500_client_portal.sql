create table public.client_portal_access (
  id text primary key,
  office_id uuid not null references public.offices(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  client_name text not null,
  client_email text,
  status_label text not null default '',
  public_notes text,
  pending_items jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  appointments jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  expires_at_ms bigint,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index client_portal_office_idx on public.client_portal_access (office_id, updated_at desc);
alter table public.client_portal_access enable row level security;
create policy client_portal_manager_write on public.client_portal_access for all to authenticated using (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant'])) with check (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'assistant']));
create policy client_portal_public_read on public.client_portal_access for select to anon, authenticated using (is_active = true and (expires_at is null or expires_at > timezone('utc', now())));
