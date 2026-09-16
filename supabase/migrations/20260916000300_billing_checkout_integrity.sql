-- Correlate every provider checkout with its durable local subscription.
alter table public.billing_checkout_sessions
  add column if not exists subscription_id uuid references public.billing_subscriptions(id);

create index if not exists billing_checkout_sessions_subscription_id_idx
  on public.billing_checkout_sessions (subscription_id);
