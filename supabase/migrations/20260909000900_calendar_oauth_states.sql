create table public.calendar_oauth_states (
  state text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

alter table public.calendar_oauth_states enable row level security;
revoke all on public.calendar_oauth_states from anon, authenticated;
