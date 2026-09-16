import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { asaasRequest, getBillingContext, json, normalizeBillingError } from '../_shared/billing.ts';

Deno.serve(async request => {
  const cors = handleCors(request); if (cors) return cors;
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);
  const context = await getBillingContext(request); const contextError = await normalizeBillingError(request, context); if (contextError) return new Response(contextError.body, { status: contextError.status, headers: { ...getCorsHeaders(request), 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const { admin, officeId } = context; const body = await request.json().catch(() => ({})); const priceCode = String(body.priceCode || '').trim();
  if (!['core_monthly', 'core_quarterly', 'core_semiannual', 'core_annual'].includes(priceCode)) return json(request, { error: 'Plano de cobrança inválido.', code: 'invalid_price' }, 400);
  const [{ data: subscription }, { data: price }] = await Promise.all([
    admin.from('billing_subscriptions').select('id, provider_subscription_id, status').eq('office_id', officeId).in('status', ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD']).maybeSingle(),
    admin.from('billing_prices').select('code, amount_cents, interval_unit').eq('code', priceCode).eq('active', true).maybeSingle(),
  ]);
  if (!subscription?.provider_subscription_id) return json(request, { error: 'Nenhuma assinatura ativa foi encontrada.', code: 'subscription_not_found' }, 404);
  if (!price) return json(request, { error: 'Plano indisponível.', code: 'price_unavailable' }, 409);
  try {
    const provider = await asaasRequest(`subscriptions/${encodeURIComponent(String(subscription.provider_subscription_id))}`, { method: 'PUT', body: JSON.stringify({ value: Number(price.amount_cents) / 100, cycle: price.interval_unit, description: `Presença Jurídica — ${priceCode}` }) });
    await admin.from('billing_subscriptions').update({ price_code: priceCode, provider_snapshot: provider, updated_at: new Date().toISOString() }).eq('id', subscription.id);
    await admin.from('offices').update({ price_code: priceCode, updated_at: new Date().toISOString() }).eq('id', officeId);
    return json(request, { priceCode, status: subscription.status, effective: 'next_charge' });
  } catch (error) {
    console.error('billing-change-plan provider request failed', { officeId, priceCode, message: error instanceof Error ? error.message : String(error) });
    return json(request, { error: 'Não foi possível alterar o plano agora. Tente novamente.', code: 'provider_plan_change_failed' }, 502);
  }
});
