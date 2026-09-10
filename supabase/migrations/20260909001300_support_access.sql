create table public.support_access_requests (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'revoked')),
  requested_at timestamptz not null default timezone('utc', now()),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index support_access_requests_office_idx on public.support_access_requests(office_id, status, requested_at);
create trigger support_access_requests_set_updated_at before update on public.support_access_requests for each row execute function public.set_updated_at();
alter table public.support_access_requests enable row level security;
create policy support_access_owner_read on public.support_access_requests for select to authenticated using (public.has_office_role(office_id, array['owner']));
create policy support_access_no_client_write on public.support_access_requests for all to authenticated using (false) with check (false);
