-- Billing foundation for the Asaas-backed SaaS subscription flow.
-- Financial truth remains in Asaas; this schema stores a durable, auditable projection.

alter table public.offices
  add column if not exists product_code text not null default 'trial',
  add column if not exists price_code text,
  add column if not exists billing_current_period_start timestamptz,
  add column if not exists billing_current_period_end timestamptz,
  add column if not exists billing_cancel_at_period_end boolean not null default false,
  add column if not exists billing_customer_id text,
  add column if not exists billing_subscription_id text,
  add column if not exists billing_provider text;

create table if not exists public.billing_products (
  code text primary key,
  name text not null,
  active boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_prices (
  code text primary key,
  product_code text not null references public.billing_products(code),
  name text not null,
  currency text not null default 'BRL',
  amount_cents integer not null check (amount_cents > 0),
  interval_unit text not null check (interval_unit in ('MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY')),
  interval_count integer not null default 1 check (interval_count > 0),
  display_monthly_cents integer not null check (display_monthly_cents > 0),
  active boolean not null default true,
  version integer not null default 1,
  valid_from timestamptz not null default timezone('utc', now()),
  valid_until timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null unique references public.offices(id) on delete cascade,
  provider text not null check (provider = 'asaas'),
  provider_customer_id text not null unique,
  document_type text not null check (document_type in ('CPF', 'CNPJ')),
  document_last4 text not null,
  legal_name text not null,
  billing_email text not null,
  billing_phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  customer_id uuid not null references public.billing_customers(id),
  provider text not null check (provider = 'asaas'),
  provider_subscription_id text unique,
  price_code text not null references public.billing_prices(code),
  status text not null check (status in ('PENDING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'CANCEL_AT_PERIOD_END', 'CANCELED', 'SUSPENDED', 'REFUNDED')),
  billing_type text check (billing_type in ('PIX', 'BOLETO', 'CREDIT_CARD')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  cancellation_reason text,
  activated_at timestamptz,
  last_payment_at timestamptz,
  next_due_date date,
  provider_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists billing_one_live_subscription_per_office
  on public.billing_subscriptions (office_id)
  where status in ('PENDING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'CANCEL_AT_PERIOD_END');

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  subscription_id uuid references public.billing_subscriptions(id),
  provider_payment_id text not null unique,
  provider_subscription_id text,
  status text not null,
  billing_type text,
  amount_cents integer not null check (amount_cents >= 0),
  net_amount_cents integer,
  due_date date,
  paid_at timestamptz,
  confirmed_at timestamptz,
  refunded_at timestamptz,
  invoice_url text,
  bank_slip_url text,
  description text,
  provider_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  price_code text not null references public.billing_prices(code),
  provider_checkout_id text unique,
  status text not null check (status in ('CREATED', 'OPEN', 'PAID', 'EXPIRED', 'CANCELED', 'FAILED')),
  billing_type text,
  expires_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'asaas'),
  provider_event_id text not null,
  event_type text not null,
  resource_id text,
  payload jsonb not null,
  processing_status text not null default 'PENDING' check (processing_status in ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED')),
  attempt_count integer not null default 0,
  last_error text,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.billing_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id),
  subscription_id uuid not null references public.billing_subscriptions(id),
  requested_by uuid references public.profiles(id),
  reason text,
  effective_at timestamptz not null,
  protocol text not null unique,
  status text not null check (status in ('REQUESTED', 'SCHEDULED', 'EFFECTIVE', 'REVERSED')),
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.billing_products (code, name, limits, features)
values
  ('trial', 'Teste', '{"maxUsers":2,"maxContacts":100,"maxStorageBytes":536870912}'::jsonb, '["Uso completo por 15 dias"]'::jsonb),
  ('core', 'Presença Jurídica', '{"maxUsers":3,"maxContacts":500,"maxStorageBytes":5368709120}'::jsonb, '["Agenda","Contatos","Tarefas","Portal do cliente"]'::jsonb),
  ('custom', 'Personalizado', '{"maxUsers":1000,"maxContacts":1000000,"maxStorageBytes":1099511627776}'::jsonb, '["Limites negociados"]'::jsonb)
on conflict (code) do update set name = excluded.name, limits = excluded.limits, features = excluded.features, updated_at = timezone('utc', now());

insert into public.billing_prices (code, product_code, name, amount_cents, interval_unit, interval_count, display_monthly_cents)
values
  ('core_monthly', 'core', 'Mensal flexível', 11990, 'MONTHLY', 1, 11990),
  ('core_quarterly', 'core', 'Trimestral', 29970, 'QUARTERLY', 3, 9990),
  ('core_semiannual', 'core', 'Semestral', 50940, 'SEMIANNUALLY', 6, 8490),
  ('core_annual', 'core', 'Anual', 95880, 'YEARLY', 12, 7990)
on conflict (code) do update set name = excluded.name, amount_cents = excluded.amount_cents, interval_unit = excluded.interval_unit, interval_count = excluded.interval_count, display_monthly_cents = excluded.display_monthly_cents;

alter table public.billing_products enable row level security;
alter table public.billing_prices enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.billing_cancellation_requests enable row level security;

create policy billing_products_member_read on public.billing_products for select to authenticated using (active);
create policy billing_prices_member_read on public.billing_prices for select to authenticated using (active);
create policy billing_customers_member_read on public.billing_customers for select to authenticated using (public.is_office_member(office_id));
create policy billing_subscriptions_member_read on public.billing_subscriptions for select to authenticated using (public.is_office_member(office_id));
create policy billing_payments_member_read on public.billing_payments for select to authenticated using (public.is_office_member(office_id));
create policy billing_checkout_member_read on public.billing_checkout_sessions for select to authenticated using (public.is_office_member(office_id));
create policy billing_cancellation_member_read on public.billing_cancellation_requests for select to authenticated using (public.is_office_member(office_id));

revoke all on public.billing_webhook_events from anon, authenticated;
revoke all on public.billing_customers, public.billing_subscriptions, public.billing_payments, public.billing_checkout_sessions, public.billing_cancellation_requests from anon;
