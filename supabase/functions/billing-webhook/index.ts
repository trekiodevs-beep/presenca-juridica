import { handleCors } from '../_shared/cors.ts';
import { asaasRequest, addPeriod, sanitizedAsaasError } from '../_shared/billing.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const safeText = (value: unknown, max = 2000) => String(value || '').slice(0, max);
const secureEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left); const b = new TextEncoder().encode(right); let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
};
const requireDb = async (operation: PromiseLike<any>, label: string) => {
  const result = await operation;
  if (result.error) throw new Error(`${label}:${result.error.code || 'database_error'}`);
  return result;
};

Deno.serve(async request => {
  const cors = handleCors(request); if (cors) return cors;
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const configuredToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN'); const suppliedToken = request.headers.get('asaas-access-token');
  if (!configuredToken || !suppliedToken || !secureEqual(suppliedToken, configuredToken)) return reply({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!url || !service) return reply({ error: 'Service unavailable' }, 503);
  const payload = await request.json().catch(() => null) as Record<string, any> | null;
  if (!payload || typeof payload.id !== 'string' || typeof payload.event !== 'string') return reply({ error: 'Invalid webhook payload' }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const providerEventId = safeText(payload.id, 255); const eventType = safeText(payload.event, 120);
  const checkout = payload.checkout && typeof payload.checkout === 'object' ? payload.checkout : null;
  const payment = payload.payment && typeof payload.payment === 'object' ? payload.payment : null;
  const subscription = payload.subscription && typeof payload.subscription === 'object' ? payload.subscription : null;
  const resourceId = safeText(checkout?.id || payment?.id || subscription?.id || '', 120) || null;

  let { data: event, error: eventError } = await admin.from('billing_webhook_events').insert({ provider: 'asaas', provider_event_id: providerEventId, event_type: eventType, resource_id: resourceId, payload }).select('id, processing_status, attempt_count').single();
  if (eventError?.code === '23505') {
    const existing = await admin.from('billing_webhook_events').select('id, processing_status, attempt_count').eq('provider', 'asaas').eq('provider_event_id', providerEventId).single();
    event = existing.data; eventError = existing.error;
  }
  if (eventError || !event) {
    console.error('billing webhook persistence failed', { code: eventError?.code, message: eventError?.message });
    return reply({ error: 'Unable to persist event' }, 500);
  }
  if (event.processing_status === 'PROCESSED' || event.processing_status === 'IGNORED') return reply({ received: true, duplicate: true });

  const attemptCount = Number(event.attempt_count || 0) + 1;
  await admin.from('billing_webhook_events').update({ processing_status: 'PROCESSING', attempt_count: attemptCount, last_error: null }).eq('id', event.id);
  try {
    if (eventType.startsWith('CHECKOUT_') && checkout?.id) {
      const { data: localCheckout } = await admin.from('billing_checkout_sessions').select('id, office_id, subscription_id, price_code').eq('provider_checkout_id', safeText(checkout.id, 120)).maybeSingle();
      if (!localCheckout) throw new Error('checkout_correlation_not_found');
      const checkoutStatus = eventType === 'CHECKOUT_PAID' ? 'PAID' : eventType === 'CHECKOUT_CANCELED' ? 'CANCELED' : eventType === 'CHECKOUT_EXPIRED' ? 'EXPIRED' : 'OPEN';
      const checkoutPatch: Record<string, unknown> = { status: checkoutStatus };
      if (checkoutStatus === 'PAID') checkoutPatch.completed_at = new Date().toISOString();
      await requireDb(admin.from('billing_checkout_sessions').update(checkoutPatch).eq('id', localCheckout.id), 'checkout_status_update_failed');
      if (eventType === 'CHECKOUT_PAID' && localCheckout.subscription_id) {
        const providerSubscriptions = await asaasRequest(`subscriptions?externalReference=${encodeURIComponent(localCheckout.id)}&limit=2`).catch(() => null);
        const matchedProviderSubscriptions = providerSubscriptions && Array.isArray(providerSubscriptions.data) ? providerSubscriptions.data : [];
        const providerSubscription = matchedProviderSubscriptions.length === 1 ? matchedProviderSubscriptions[0] : null;
        const start = checkout.subscription?.nextDueDate ? new Date(checkout.subscription.nextDueDate) : new Date();
        const { data: price } = await admin.from('billing_prices').select('product_code, interval_unit').eq('code', localCheckout.price_code).single();
        const end = addPeriod(start, String(price?.interval_unit || 'MONTHLY'));
        const now = new Date().toISOString();
        await requireDb(admin.from('billing_subscriptions').update({ status: 'ACTIVE', activated_at: now, last_payment_at: now, current_period_start: start.toISOString(), current_period_end: end.toISOString(), next_due_date: start.toISOString().slice(0, 10), provider_subscription_id: providerSubscription?.id || null, provider_snapshot: providerSubscription || checkout, updated_at: now }).eq('id', localCheckout.subscription_id), 'subscription_activation_failed');
        await requireDb(admin.from('offices').update({ plan_code: 'core', product_code: price?.product_code || 'core', price_code: localCheckout.price_code, subscription_status: 'ACTIVE', billing_subscription_id: localCheckout.subscription_id, billing_provider: 'asaas', billing_current_period_start: start.toISOString(), billing_current_period_end: end.toISOString(), billing_cancel_at_period_end: false, updated_at: now }).eq('id', localCheckout.office_id), 'office_activation_failed');
      }
      if (['CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED'].includes(eventType) && localCheckout.subscription_id) await requireDb(admin.from('billing_subscriptions').update({ status: 'CANCELED', cancellation_reason: checkoutStatus === 'EXPIRED' ? 'Checkout expirado' : 'Checkout cancelado', updated_at: new Date().toISOString() }).eq('id', localCheckout.subscription_id).eq('status', 'PENDING'), 'subscription_checkout_close_failed');
    }

    const providerSubscriptionId = safeText(payment?.subscription || subscription?.id || '', 120) || null;
    let localSubscription: any = null;
    if (providerSubscriptionId) {
      const result = await admin.from('billing_subscriptions').select('id, office_id, price_code, current_period_start, current_period_end').eq('provider_subscription_id', providerSubscriptionId).maybeSingle();
      localSubscription = result.data;
    }
    const externalReference = safeText(payment?.externalReference || subscription?.externalReference || '', 120);
    if (!localSubscription && externalReference) {
      const { data: localCheckout } = await admin.from('billing_checkout_sessions').select('subscription_id').eq('id', externalReference).maybeSingle();
      if (localCheckout?.subscription_id) {
        const result = await admin.from('billing_subscriptions').select('id, office_id, price_code, current_period_start, current_period_end').eq('id', localCheckout.subscription_id).maybeSingle();
        localSubscription = result.data;
        if (localSubscription && providerSubscriptionId) await admin.from('billing_subscriptions').update({ provider_subscription_id: providerSubscriptionId, updated_at: new Date().toISOString() }).eq('id', localSubscription.id);
      }
    }

    if (payment?.id && localSubscription) {
      const status = safeText(payment.status, 80); const now = new Date().toISOString();
      await requireDb(admin.from('billing_payments').upsert({ office_id: localSubscription.office_id, subscription_id: localSubscription.id, provider_payment_id: safeText(payment.id, 120), provider_subscription_id: providerSubscriptionId, status, billing_type: payment.billingType || null, amount_cents: Math.round(Number(payment.value || 0) * 100), net_amount_cents: payment.netValue == null ? null : Math.round(Number(payment.netValue) * 100), due_date: payment.dueDate || null, paid_at: payment.paymentDate || payment.clientPaymentDate || null, confirmed_at: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(status) ? now : null, refunded_at: ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(status) ? now : null, invoice_url: payment.invoiceUrl || null, bank_slip_url: payment.bankSlipUrl || null, description: safeText(payment.description, 500), provider_snapshot: payment, updated_at: now }, { onConflict: 'provider_payment_id' }), 'payment_upsert_failed');
      if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(status)) {
        const { data: price } = await admin.from('billing_prices').select('interval_unit').eq('code', localSubscription.price_code).single();
        const periodStart = payment.dueDate ? new Date(`${payment.dueDate}T00:00:00.000Z`) : new Date(now);
        const periodEnd = addPeriod(periodStart, String(price?.interval_unit || 'MONTHLY'));
        await requireDb(admin.from('billing_subscriptions').update({ status: 'ACTIVE', activated_at: now, last_payment_at: now, current_period_start: periodStart.toISOString(), current_period_end: periodEnd.toISOString(), updated_at: now }).eq('id', localSubscription.id), 'subscription_payment_activation_failed');
        await requireDb(admin.from('offices').update({ plan_code: 'core', product_code: 'core', price_code: localSubscription.price_code, subscription_status: 'ACTIVE', billing_subscription_id: localSubscription.id, billing_provider: 'asaas', billing_current_period_start: periodStart.toISOString(), billing_current_period_end: periodEnd.toISOString(), billing_cancel_at_period_end: false, updated_at: now }).eq('id', localSubscription.office_id), 'office_payment_activation_failed');
      }
      if (status === 'OVERDUE') await admin.from('billing_subscriptions').update({ status: 'PAST_DUE', updated_at: now }).eq('id', localSubscription.id);
      if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(status) || eventType.includes('CHARGEBACK')) await admin.from('billing_subscriptions').update({ status: eventType.includes('CHARGEBACK') ? 'SUSPENDED' : 'REFUNDED', updated_at: now }).eq('id', localSubscription.id);
    }

    if (eventType.startsWith('SUBSCRIPTION_') && providerSubscriptionId && localSubscription) {
      const providerSubscription = await asaasRequest(`subscriptions/${encodeURIComponent(providerSubscriptionId)}`);
      await admin.from('billing_subscriptions').update({ provider_snapshot: providerSubscription, next_due_date: providerSubscription.nextDueDate || null, billing_type: providerSubscription.billingType || null, updated_at: new Date().toISOString() }).eq('id', localSubscription.id);
    }
    await requireDb(admin.from('billing_webhook_events').update({ processing_status: 'PROCESSED', processed_at: new Date().toISOString(), last_error: null }).eq('id', event.id), 'event_completion_failed');
  } catch (error) {
    const safeError = sanitizedAsaasError(error);
    console.error('billing webhook processing failed', { eventId: event.id, eventType, ...safeError });
    await admin.from('billing_webhook_events').update({ processing_status: 'FAILED', last_error: safeText(JSON.stringify(safeError)) }).eq('id', event.id);
    // The inbox row is durable and duplicate deliveries re-enter FAILED events.
    // A non-2xx response asks Asaas to retry while preserving idempotency by event id.
    return reply({ received: true, processing: 'failed', retryable: true }, 500);
  }
  return reply({ received: true });
});
