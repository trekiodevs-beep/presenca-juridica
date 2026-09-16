import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { asaasRequest, getBillingContext, json, normalizeBillingError } from '../_shared/billing.ts';

Deno.serve(async request => {
  const cors = handleCors(request); if (cors) return cors;
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);
  const context = await getBillingContext(request); const contextError = await normalizeBillingError(request, context); if (contextError) return new Response(contextError.body, { status: contextError.status, headers: { ...getCorsHeaders(request), 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const { admin, officeId, userId } = context;
  const { data: subscription, error: subscriptionError } = await admin.from('billing_subscriptions').select('id, provider_subscription_id, status, current_period_end').eq('office_id', officeId).in('status', ['PENDING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'CANCEL_AT_PERIOD_END']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (subscriptionError) return json(request, { error: 'Não foi possível carregar a assinatura.', code: 'subscription_query_failed' }, 500);
  if (!subscription) return json(request, { error: 'Nenhuma assinatura ativa foi encontrada.', code: 'subscription_not_found' }, 404);
  if (subscription.provider_subscription_id) {
    try { await asaasRequest(`subscriptions/${encodeURIComponent(String(subscription.provider_subscription_id))}`, { method: 'DELETE' }); }
    catch (error) { console.error('billing cancellation provider request failed', { officeId, message: error instanceof Error ? error.message : String(error) }); return json(request, { error: 'Não foi possível cancelar a renovação. Tente novamente.', code: 'provider_cancellation_failed' }, 502); }
  }
  const protocol = `PJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const effectiveAt = subscription.current_period_end || new Date().toISOString();
  const { error: requestError } = await admin.from('billing_cancellation_requests').insert({ office_id: officeId, subscription_id: subscription.id, requested_by: userId, effective_at: effectiveAt, protocol, status: 'SCHEDULED' });
  if (requestError) return json(request, { error: 'Não foi possível registrar o cancelamento.', code: 'cancellation_save_failed' }, 500);
  await admin.from('billing_subscriptions').update({ status: 'CANCEL_AT_PERIOD_END', cancel_at_period_end: true, canceled_at: new Date().toISOString(), cancellation_reason: 'Solicitado pelo cliente', updated_at: new Date().toISOString() }).eq('id', subscription.id);
  await admin.from('offices').update({ billing_cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq('id', officeId);
  await admin.from('audit_logs').insert({ office_id: officeId, actor_user_id: userId, action: 'billing.cancellation_requested', target_type: 'billing_subscription', target_id: subscription.id, metadata: { protocol, effectiveAt } });
  return json(request, { status: 'CANCEL_AT_PERIOD_END', effectiveAt, protocol });
});
