create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  office_id uuid references public.offices(id) on delete set null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  email text not null,
  request_type text not null check (request_type in ('access', 'correction', 'deletion', 'portability', 'information', 'revocation')),
  details text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index support_tickets_status_idx on public.support_tickets(status, created_at);
create index privacy_requests_status_idx on public.privacy_requests(status, created_at);
create trigger support_tickets_set_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();
create trigger privacy_requests_set_updated_at before update on public.privacy_requests for each row execute function public.set_updated_at();
alter table public.support_tickets enable row level security;
alter table public.privacy_requests enable row level security;
create policy support_tickets_self_read on public.support_tickets for select to authenticated using (user_id = auth.uid());
create policy privacy_requests_no_client_access on public.privacy_requests for all to authenticated using (false) with check (false);
create policy support_tickets_no_client_write on public.support_tickets for all to authenticated using (false) with check (false);
