create table public.financial_records (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  type text not null default 'Outro',
  status text not null default 'Previsto',
  description text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  due_at timestamptz,
  paid_at timestamptz,
  payment_method text,
  notes text,
  proof_document_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index financial_records_office_due_idx on public.financial_records (office_id, due_at);
alter table public.financial_records enable row level security;
create policy financial_member_read on public.financial_records for select to authenticated using (public.is_office_member(office_id));
create policy financial_operator_write on public.financial_records for all to authenticated using (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'finance'])) with check (public.has_office_role(office_id, array['owner', 'admin', 'lawyer', 'finance']));
create trigger financial_records_set_updated_at before update on public.financial_records for each row execute function public.set_updated_at();
