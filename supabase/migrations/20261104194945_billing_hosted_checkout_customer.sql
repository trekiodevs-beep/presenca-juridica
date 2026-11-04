-- Hosted card Checkout collects the payer before linking a local customer.
alter table public.billing_subscriptions alter column customer_id drop not null;
alter table public.billing_subscriptions add constraint billing_subscription_customer_required
  check (customer_id is not null or (billing_type = 'CREDIT_CARD' and status in ('PENDING', 'CANCELED')));
