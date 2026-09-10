create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'lawyer', 'assistant', 'finance', 'read')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index invitations_office_status_idx on public.invitations (office_id, status, expires_at);
create trigger invitations_set_updated_at before update on public.invitations for each row execute function public.set_updated_at();
alter table public.invitations enable row level security;
create policy invitations_manager_read on public.invitations for select to authenticated using (public.has_office_role(office_id, array['owner', 'admin']));
create policy invitations_no_client_write on public.invitations for all to authenticated using (false) with check (false);
