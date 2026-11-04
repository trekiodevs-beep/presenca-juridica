import { handleCors } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { asaasRequest, getBillingContext, json, normalizeBillingError, safeAsaasUrl, sanitizedAsaasError } from '../_shared/billing.ts';

const cycleFor = (unit: string) => ({ MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', SEMIANNUALLY: 'SEMIANNUALLY', YEARLY: 'YEARLY' }[unit] || 'MONTHLY');
const cpfCnpj = (value: unknown) => String(value || '').replace(/\D/g, '');
const validDocument = (value: string) => value.length === 11 || value.length === 14;
const paymentUrl = (payment: Record<string, unknown> | null) => safeAsaasUrl(payment?.invoiceUrl || payment?.bankSlipUrl);

Deno.serve(async request => {
  const cors = handleCors(request); if (cors) return cors;
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);

  let officeId = ''; let sessionId = ''; let subscriptionId = '';
  try {
    const context = await getBillingContext(request);
    const contextError = await normalizeBillingError(request, context);
    if (contextError) return contextError;
    const { admin, userId } = context; officeId = context.officeId;
    const body = await request.json().catch(() => ({}));
    const priceCode = String(body.priceCode || '').trim(); const billingType = String(body.billingType || 'CREDIT_CARD').trim(); const document = cpfCnpj(body.payer?.cpfCnpj);
    if (!['core_monthly', 'core_quarterly', 'core_semiannual', 'core_annual'].includes(priceCode)) return json(request, { error: 'Plano de cobrança inválido.', code: 'invalid_price' }, 400);
    if (!['CREDIT_CARD', 'PIX', 'BOLETO'].includes(billingType) || !validDocument(document)) return json(request, { error: 'Informe um CPF ou CNPJ válido e uma forma de pagamento.', code: 'invalid_payer' }, 400);

    const [{ data: price, error: priceError }, { data: office, error: officeError }, { data: liveSubscription, error: subscriptionLookupError }] = await Promise.all([
      admin.from('billing_prices').select('code, name, amount_cents, interval_unit').eq('code', priceCode).eq('active', true).maybeSingle(),
      admin.from('offices').select('name, email, whatsapp').eq('id', officeId).maybeSingle(),
      admin.from('billing_subscriptions').select('id, price_code, status').eq('office_id', officeId).in('status', ['PENDING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'CANCEL_AT_PERIOD_END']).limit(1).maybeSingle(),
    ]);
    if (priceError) return json(request, { error: 'Não foi possível carregar o plano.', code: 'price_query_failed' }, 500);
    if (!price) return json(request, { error: 'Plano indisponível.', code: 'price_unavailable' }, 409);
    if (officeError || !office) return json(request, { error: 'Escritório não encontrado.', code: 'office_not_found' }, 404);
    if (subscriptionLookupError) return json(request, { error: 'Não foi possível consultar a assinatura.', code: 'subscription_query_failed' }, 500);
    if (liveSubscription) {
      if (liveSubscription.status === 'PENDING') {
        const { data: pendingCheckout, error: checkoutLookupError } = await admin.from('billing_checkout_sessions')
          .select('provider_checkout_id, status, expires_at').eq('subscription_id', liveSubscription.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (checkoutLookupError) return json(request, { error: 'Não foi possível consultar o checkout.', code: 'checkout_query_failed' }, 500);
        if (pendingCheckout?.status === 'OPEN' && pendingCheckout.provider_checkout_id) {
          if (liveSubscription.price_code !== priceCode) return json(request, { error: 'Já existe um checkout em andamento para outro período. Conclua-o antes de escolher outro plano.', code: 'checkout_for_other_price', priceCode: liveSubscription.price_code }, 409);
          const { data: pendingSubscription, error: pendingError } = await admin.from('billing_subscriptions').select('billing_type, provider_subscription_id, provider_snapshot').eq('id', liveSubscription.id).single();
          if (pendingError || !pendingSubscription) return json(request, { error: 'Não foi possível consultar a assinatura.', code: 'subscription_query_failed' }, 500);
          if (pendingSubscription.billing_type !== billingType) return json(request, { error: 'Já existe um pagamento em andamento com outra forma de pagamento.', code: 'checkout_for_other_method' }, 409);
          if (pendingSubscription.billing_type === 'CREDIT_CARD') {
            if (!pendingCheckout.expires_at || new Date(pendingCheckout.expires_at).getTime() <= Date.now()) return json(request, { error: 'O checkout anterior venceu e aguarda conciliação. Contate o suporte se ainda não puder escolher outro plano.', code: 'checkout_reconciliation_required' }, 409);
            const checkoutUrl = safeAsaasUrl(pendingSubscription.provider_snapshot?.link);
            if (checkoutUrl) return json(request, { checkoutUrl, checkoutId: pendingCheckout.provider_checkout_id, status: 'PENDING' }, 200);
          } else if (pendingSubscription.provider_subscription_id) {
            const payments = await asaasRequest(`subscriptions/${encodeURIComponent(String(pendingSubscription.provider_subscription_id))}/payments`);
            const firstPayment = Array.isArray(payments.data) ? payments.data[0] as Record<string, unknown> : null;
            const checkoutUrl = paymentUrl(firstPayment);
            if (checkoutUrl) return json(request, { checkoutUrl, checkoutId: pendingCheckout.provider_checkout_id, status: 'PENDING' }, 200);
            return json(request, { status: 'PENDING', code: 'payment_link_pending' }, 202);
          }
        }
      }
      return json(request, { error: 'Já existe uma assinatura ou checkout em andamento. Aguarde a atualização ou contate o suporte.', code: 'subscription_already_exists' }, 409);
    }

    let customerId = '';
    const { data: currentCustomer } = await admin.from('billing_customers').select('provider_customer_id').eq('office_id', officeId).maybeSingle();
    if (currentCustomer?.provider_customer_id) customerId = String(currentCustomer.provider_customer_id);
    if (!customerId) {
      const existing = await asaasRequest(`customers?externalReference=${encodeURIComponent(officeId)}&limit=1`);
      customerId = String((Array.isArray(existing.data) ? existing.data[0]?.id : '') || '');
    }
    if (!customerId) {
      const created = await asaasRequest('customers', { method: 'POST', body: JSON.stringify({ name: String(body.payer?.name || office.name), cpfCnpj: document, email: String(body.payer?.email || office.email), mobilePhone: String(body.payer?.mobilePhone || office.whatsapp || ''), externalReference: officeId }) });
      customerId = String(created.id || '');
    }
    if (!customerId) throw new Error('asaas_customer_id_missing');

    const { data: localCustomer, error: customerSaveError } = await admin.from('billing_customers').upsert({ office_id: officeId, provider: 'asaas', provider_customer_id: customerId, document_type: document.length === 14 ? 'CNPJ' : 'CPF', document_last4: document.slice(-4), legal_name: String(body.payer?.name || office.name), billing_email: String(body.payer?.email || office.email), billing_phone: String(body.payer?.mobilePhone || office.whatsapp || '') }, { onConflict: 'office_id' }).select('id').single();
    if (customerSaveError || !localCustomer) throw new Error(`customer_save_failed:${customerSaveError?.code || 'missing_row'}`);

    sessionId = crypto.randomUUID();
    const nextDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { data: localSubscription, error: subscriptionError } = await admin.from('billing_subscriptions').insert({ office_id: officeId, customer_id: localCustomer.id, provider: 'asaas', price_code: priceCode, status: 'PENDING', billing_type: billingType, next_due_date: nextDueDate.toISOString().slice(0, 10) }).select('id').single();
    if (subscriptionError?.code === '23505') return json(request, { error: 'Já existe um pagamento em andamento. Atualize a página para continuar.', code: 'subscription_already_exists' }, 409);
    if (subscriptionError || !localSubscription) return json(request, { error: 'Não foi possível registrar a assinatura.', code: 'subscription_save_failed' }, 500);
    subscriptionId = String(localSubscription.id);
    const { error: sessionError } = await admin.from('billing_checkout_sessions').insert({ id: sessionId, office_id: officeId, subscription_id: subscriptionId, price_code: priceCode, status: 'CREATED', billing_type: billingType, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), created_by: userId });
    if (sessionError) {
      await admin.from('billing_subscriptions').update({ status: 'CANCELED', cancellation_reason: 'Falha ao criar sessão local', updated_at: new Date().toISOString() }).eq('id', subscriptionId);
      return json(request, { error: 'Não foi possível registrar o checkout.', code: 'session_save_failed' }, 500);
    }

    let providerId = ''; let checkoutUrl = '';
    if (billingType === 'BOLETO' || billingType === 'PIX') {
      const subscription = await asaasRequest('subscriptions', { method: 'POST', body: JSON.stringify({ customer: customerId, billingType, value: Number(price.amount_cents) / 100, nextDueDate: nextDueDate.toISOString().slice(0, 10), cycle: cycleFor(String(price.interval_unit)), description: `Presença Jurídica — ${price.name}`, externalReference: sessionId }) });
      providerId = String(subscription.id || '');
      if (!providerId) throw new Error('asaas_subscription_id_missing');
      const { error: providerLinkError } = await admin.from('billing_subscriptions').update({ provider_subscription_id: providerId, provider_snapshot: subscription, updated_at: new Date().toISOString() }).eq('id', subscriptionId);
      if (providerLinkError) throw new Error(`provider_subscription_link_failed:${providerLinkError.code}`);
      const payments = await asaasRequest(`subscriptions/${encodeURIComponent(providerId)}/payments`);
      const firstPayment = Array.isArray(payments.data) ? payments.data[0] : null;
      checkoutUrl = paymentUrl(firstPayment);
    } else {
      const appUrl = Deno.env.get('APP_URL') || 'https://crm.trekio-tecnologia.com.br';
      const checkout = await asaasRequest('checkouts', { method: 'POST', body: JSON.stringify({ customer: customerId, billingTypes: ['CREDIT_CARD'], chargeTypes: ['RECURRENT'], minutesToExpire: 60, externalReference: sessionId, items: [{ name: `Presença Jurídica — ${price.name}`, description: 'Assinatura do CRM jurídico', quantity: 1, value: Number(price.amount_cents) / 100 }], subscription: { cycle: cycleFor(String(price.interval_unit)), nextDueDate: nextDueDate.toISOString().slice(0, 10) }, callback: { successUrl: `${appUrl}/billing?checkout=success`, cancelUrl: `${appUrl}/billing?checkout=canceled`, expiredUrl: `${appUrl}/billing?checkout=expired` } }) });
      providerId = String(checkout.id || ''); checkoutUrl = safeAsaasUrl(checkout.link);
      if (!providerId || !checkoutUrl) throw new Error('asaas_checkout_response_incomplete');
    }

    const { error: sessionLinkError } = await admin.from('billing_checkout_sessions').update({ provider_checkout_id: providerId, status: 'OPEN' }).eq('id', sessionId);
    if (sessionLinkError) throw new Error(`provider_checkout_link_failed:${sessionLinkError.code}`);
    if (billingType === 'CREDIT_CARD') {
      const { error: snapshotError } = await admin.from('billing_subscriptions').update({ provider_snapshot: { id: providerId, link: checkoutUrl }, updated_at: new Date().toISOString() }).eq('id', subscriptionId).eq('status', 'PENDING');
      if (snapshotError) console.error('checkout link persistence failed', { officeId, sessionId, code: snapshotError.code });
    }
    if (!checkoutUrl && billingType !== 'CREDIT_CARD') return json(request, { status: 'PENDING', code: 'payment_link_pending', checkoutId: providerId }, 202);
    return json(request, { checkoutUrl, checkoutId: providerId, status: 'PENDING' }, 201);
  } catch (error) {
    console.error('billing-create-checkout failed', { officeId, sessionId, ...sanitizedAsaasError(error) });
    const url = Deno.env.get('SUPABASE_URL'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
    if (sessionId && url && service) {
      const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
      await admin.from('billing_checkout_sessions').update({ status: 'FAILED' }).eq('id', sessionId);
      // Only a definitive provider-side 4xx proves that no resource was accepted. Timeouts,
      // 5xx responses and local linking failures remain PENDING for operator reconciliation.
      if (subscriptionId && /^asaas_http_4\d\d$/.test(error instanceof Error ? error.message : '')) await admin.from('billing_subscriptions').update({ status: 'CANCELED', cancellation_reason: 'Requisição rejeitada pelo provedor', updated_at: new Date().toISOString() }).eq('id', subscriptionId).is('provider_subscription_id', null);
    }
    return json(request, { error: 'Não foi possível abrir o checkout agora. Tente novamente.', code: 'provider_checkout_failed' }, 502);
  }
});
