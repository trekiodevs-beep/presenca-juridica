alter table public.profiles
  add column if not exists office_id uuid references public.offices(id) on delete set null,
  add column if not exists role text not null default 'admin' check (role in ('owner', 'admin', 'lawyer', 'assistant', 'finance', 'read'));

create index if not exists profiles_office_idx on public.profiles (office_id);
