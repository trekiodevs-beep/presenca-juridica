import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { asaasRequest, getBillingContext, json, normalizeBillingError } from '../_shared/billing.ts';

Deno.serve(async request => {
  const cors = handleCors(request); if (cors) return cors;
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);
  const context = await getBillingContext(request); const contextError = await normalizeBillingError(request, context); if (contextError) return new Response(contextError.body, { status: contextError.status, headers: { ...getCorsHeaders(request), 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const { admin, officeId } = context; const body = await request.json().catch(() => ({})); const billingType = String(body.billingType || '').trim();
  if (billingType === 'CREDIT_CARD') return json(request, { error: 'A troca de cartão exige uma jornada segura específica.', code: 'credit_card_update_not_implemented' }, 409);
  if (!['PIX', 'BOLETO'].includes(billingType)) return json(request, { error: 'Forma de pagamento inválida.', code: 'invalid_billing_type' }, 400);
  const { data: subscription } = await admin.from('billing_subscriptions').select('id, provider_subscription_id, status').eq('office_id', officeId).in('status', ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD']).maybeSingle();
  if (!subscription?.provider_subscription_id) return json(request, { error: 'Nenhuma assinatura ativa foi encontrada.', code: 'subscription_not_found' }, 404);
  try {
    const provider = await asaasRequest(`subscriptions/${encodeURIComponent(String(subscription.provider_subscription_id))}`, { method: 'PUT', body: JSON.stringify({ billingType, updatePendingPayments: true }) });
    await admin.from('billing_subscriptions').update({ billing_type: billingType, provider_snapshot: provider, updated_at: new Date().toISOString() }).eq('id', subscription.id);
    return json(request, { billingType, status: subscription.status });
  } catch (error) {
    console.error('billing-update-method provider request failed', { officeId, message: error instanceof Error ? error.message : String(error) });
    return json(request, { error: 'Não foi possível atualizar a forma de pagamento.', code: 'provider_method_change_failed' }, 502);
  }
});
