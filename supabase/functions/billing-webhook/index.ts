import { handleCors } from '../_shared/cors.ts';
import { asaasRequest } from '../_shared/billing.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const safeText = (value: unknown, max = 2000) => String(value || '').slice(0, max);
const secureEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left); const b = new TextEncoder().encode(right); let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
};

Deno.serve(async request => {
  const cors = handleCors(request); if (cors) return cors;
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const configuredToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
  const suppliedToken = request.headers.get('asaas-access-token');
  if (!configuredToken || !suppliedToken || !secureEqual(suppliedToken, configuredToken)) return reply({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!url || !service) return reply({ error: 'Service unavailable' }, 503);
  const payload = await request.json().catch(() => null) as Record<string, any> | null;
  if (!payload || typeof payload.event !== 'string') return reply({ error: 'Invalid webhook payload' }, 400);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const providerEventId = safeText(payload.id || `${payload.event}:${payload.payment?.id || payload.subscription?.id || crypto.randomUUID()}`, 255);
  const eventType = safeText(payload.event, 120); const payment = payload.payment && typeof payload.payment === 'object' ? payload.payment : null; const providerPaymentId = payment?.id ? safeText(payment.id, 120) : null; const providerSubscriptionId = safeText(payment?.subscription || payload.subscription?.id || '', 120) || null;
  const { data: event, error: eventError } = await admin.from('billing_webhook_events').insert({ provider: 'asaas', provider_event_id: providerEventId, event_type: eventType, resource_id: providerPaymentId || providerSubscriptionId, payload }).select('id').single();
  if (eventError) {
    if (eventError.code === '23505') return reply({ received: true, duplicate: true });
    console.error('billing webhook event persistence failed', { code: eventError.code, message: eventError.message });
    return reply({ error: 'Unable to persist event' }, 500);
  }
  try {
    if (providerPaymentId) {
      let { data: existingSubscription } = await admin.from('billing_subscriptions').select('id, office_id, price_id, price_code, current_period_start, current_period_end').eq('provider_subscription_id', providerSubscriptionId).maybeSingle();
      if (!existingSubscription && payment.externalReference) {
        const { data: checkout } = await admin.from('billing_checkout_sessions').select('id, office_id, subscription_id').eq('id', payment.externalReference).maybeSingle();
        if (checkout?.subscription_id) {
          const { data: recovered } = await admin.from('billing_subscriptions').select('id, office_id, price_id, price_code, current_period_start, current_period_end').eq('id', checkout.subscription_id).maybeSingle();
          existingSubscription = recovered;
          if (recovered && providerSubscriptionId) await admin.from('billing_subscriptions').update({ provider_subscription_id: providerSubscriptionId, updated_at: new Date().toISOString() }).eq('id', recovered.id);
        }
      }
      if (existingSubscription) {
        const status = safeText(payment.status, 80);
        const patch: Record<string, unknown> = { office_id: existingSubscription.office_id, subscription_id: existingSubscription.id, provider_payment_id: providerPaymentId, provider_subscription_id: providerSubscriptionId, status, billing_type: payment.billingType || null, amount_cents: Math.round(Number(payment.value || 0) * 100), net_amount_cents: payment.netValue == null ? null : Math.round(Number(payment.netValue) * 100), due_date: payment.dueDate || null, paid_at: payment.paymentDate || payment.clientPaymentDate || null, confirmed_at: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(status) ? new Date().toISOString() : null, refunded_at: ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(status) ? new Date().toISOString() : null, invoice_url: payment.invoiceUrl || null, bank_slip_url: payment.bankSlipUrl || null, description: safeText(payment.description, 500), provider_snapshot: payment, updated_at: new Date().toISOString() };
        await admin.from('billing_payments').upsert(patch, { onConflict: 'provider_payment_id' });
        if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(status)) {
          const now = new Date().toISOString();
          await admin.from('billing_subscriptions').update({ status: 'ACTIVE', activated_at: now, last_payment_at: now, updated_at: now }).eq('id', existingSubscription.id);
          const { data: price } = existingSubscription.price_id ? await admin.from('billing_prices').select('code, product_code').eq('id', existingSubscription.price_id).maybeSingle() : { data: null };
          await admin.from('offices').update({ plan_code: 'core', product_code: price?.product_code || 'core', price_code: price?.code || existingSubscription.price_code || null, subscription_status: 'ACTIVE', billing_subscription_id: existingSubscription.id, billing_provider: 'asaas', billing_current_period_start: existingSubscription.current_period_start, billing_current_period_end: existingSubscription.current_period_end, billing_cancel_at_period_end: false, updated_at: now }).eq('id', existingSubscription.office_id);
        }
        if (status === 'OVERDUE') await admin.from('billing_subscriptions').update({ status: 'PAST_DUE', updated_at: new Date().toISOString() }).eq('id', existingSubscription.id);
        if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(status) || eventType.includes('CHARGEBACK')) await admin.from('billing_subscriptions').update({ status: eventType.includes('CHARGEBACK') ? 'SUSPENDED' : 'REFUNDED', updated_at: new Date().toISOString() }).eq('id', existingSubscription.id);
      }
    }
    if (eventType.startsWith('SUBSCRIPTION_') && providerSubscriptionId) {
      const providerSubscription = await asaasRequest(`subscriptions/${encodeURIComponent(providerSubscriptionId)}`).catch(() => null);
      if (providerSubscription) await admin.from('billing_subscriptions').update({ provider_snapshot: providerSubscription, next_due_date: providerSubscription.nextDueDate || null, updated_at: new Date().toISOString() }).eq('provider_subscription_id', providerSubscriptionId);
    }
    await admin.from('billing_webhook_events').update({ processing_status: 'PROCESSED', processed_at: new Date().toISOString(), attempt_count: 1 }).eq('id', event.id);
  } catch (error) {
    console.error('billing webhook processing failed', { eventId: event.id, eventType, message: error instanceof Error ? error.message : String(error) });
    await admin.from('billing_webhook_events').update({ processing_status: 'FAILED', last_error: safeText(error instanceof Error ? error.message : error), attempt_count: 1 }).eq('id', event.id);
    return reply({ error: 'Event processing failed' }, 500);
  }
  return reply({ received: true });
});
