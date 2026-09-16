import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { asaasRequest, getBillingContext, json, normalizeBillingError, addPeriod } from '../_shared/billing.ts';

const cycleFor = (unit: string) => ({ MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', SEMIANNUALLY: 'SEMIANNUALLY', YEARLY: 'YEARLY' }[unit] || 'MONTHLY');
const cpfCnpj = (value: unknown) => String(value || '').replace(/\D/g, '');
const validDocument = (value: string) => value.length === 11 || value.length === 14;

Deno.serve(async request => {
  const cors = handleCors(request); if (cors) return cors;
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);
  const context = await getBillingContext(request); const contextError = await normalizeBillingError(request, context); if (contextError) return new Response(contextError.body, { status: contextError.status, headers: { ...getCorsHeaders(request), 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const { admin, officeId, userId } = context;
  const body = await request.json().catch(() => ({}));
  const priceCode = String(body.priceCode || '').trim(); const billingType = String(body.billingType || 'CREDIT_CARD').trim(); const document = cpfCnpj(body.payer?.cpfCnpj);
  if (!['core_monthly', 'core_quarterly', 'core_semiannual', 'core_annual'].includes(priceCode)) return json(request, { error: 'Plano de cobrança inválido.', code: 'invalid_price' }, 400);
  if (!['CREDIT_CARD', 'PIX', 'BOLETO'].includes(billingType) || !validDocument(document)) return json(request, { error: 'Informe um CPF ou CNPJ válido e uma forma de pagamento.', code: 'invalid_payer' }, 400);
  const { data: price, error: priceError } = await admin.from('billing_prices').select('code, name, amount_cents, interval_unit, interval_count, display_monthly_cents').eq('code', priceCode).eq('active', true).maybeSingle();
  if (priceError) return json(request, { error: 'Não foi possível carregar o plano.', code: 'price_query_failed' }, 500);
  if (!price) return json(request, { error: 'Plano indisponível.', code: 'price_unavailable' }, 409);
  const { data: office, error: officeError } = await admin.from('offices').select('name, email, whatsapp').eq('id', officeId).maybeSingle();
  if (officeError || !office) return json(request, { error: 'Escritório não encontrado.', code: 'office_not_found' }, 404);
  let customerId = '';
  const { data: currentCustomer } = await admin.from('billing_customers').select('id, provider_customer_id').eq('office_id', officeId).maybeSingle();
  if (currentCustomer?.provider_customer_id) customerId = String(currentCustomer.provider_customer_id);
  if (!customerId) {
    const existing = await asaasRequest(`customers?externalReference=${encodeURIComponent(officeId)}&limit=1`);
    customerId = String((Array.isArray(existing.data) ? existing.data[0]?.id : '') || '');
  }
  if (!customerId) {
    const created = await asaasRequest('customers', { method: 'POST', body: JSON.stringify({ name: String(body.payer?.name || office.name), cpfCnpj: document, email: String(body.payer?.email || office.email), mobilePhone: String(body.payer?.mobilePhone || office.whatsapp || ''), externalReference: officeId }) });
    customerId = String(created.id || '');
  }
  if (!customerId) return json(request, { error: 'Não foi possível cadastrar os dados do pagador.', code: 'provider_customer_failed' }, 502);
  const documentType = document.length === 14 ? 'CNPJ' : 'CPF';
  const { error: customerSaveError } = await admin.from('billing_customers').upsert({ office_id: officeId, provider: 'asaas', provider_customer_id: customerId, document_type: documentType, document_last4: document.slice(-4), legal_name: String(body.payer?.name || office.name), billing_email: String(body.payer?.email || office.email), billing_phone: String(body.payer?.mobilePhone || office.whatsapp || '') }, { onConflict: 'office_id' });
  if (customerSaveError) return json(request, { error: 'Não foi possível salvar o cadastro de cobrança.', code: 'customer_save_failed' }, 500);
  const { data: localCustomer } = await admin.from('billing_customers').select('id').eq('office_id', officeId).single();
  const sessionId = crypto.randomUUID(); const now = new Date(); const nextDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); const periodEnd = addPeriod(nextDueDate, String(price.interval_unit));
  let providerSubscriptionId = ''; let checkoutId = ''; let checkoutUrl = '';
  try {
    if (billingType === 'BOLETO') {
      const subscription = await asaasRequest('subscriptions', { method: 'POST', body: JSON.stringify({ customer: customerId, billingType, value: Number(price.amount_cents) / 100, nextDueDate: nextDueDate.toISOString().slice(0, 10), cycle: cycleFor(String(price.interval_unit)), description: `Presença Jurídica — ${price.name}`, externalReference: sessionId }) });
      providerSubscriptionId = String(subscription.id || '');
      const payments = await asaasRequest(`payments?subscription=${encodeURIComponent(providerSubscriptionId)}&limit=1`);
      const firstPayment = Array.isArray(payments.data) ? payments.data[0] : null;
      checkoutUrl = String(firstPayment?.invoiceUrl || firstPayment?.bankSlipUrl || '');
    } else {
      const appUrl = Deno.env.get('APP_URL') || 'https://crm.trekio-tecnologia.com.br';
      const checkoutPayload = {
        billingTypes: [billingType], chargeTypes: ['RECURRENT'], externalReference: sessionId, customer: customerId,
        items: [{ name: `Presença Jurídica — ${price.name}`, quantity: 1, value: Number(price.amount_cents) / 100 }],
        subscription: { cycle: cycleFor(String(price.interval_unit)), value: Number(price.amount_cents) / 100, nextDueDate: nextDueDate.toISOString().slice(0, 10), description: `Presença Jurídica — ${price.name}` },
        callback: { successUrl: `${appUrl}/billing?checkout=success`, cancelUrl: `${appUrl}/billing?checkout=canceled` },
      };
      const checkout = await asaasRequest('checkouts', { method: 'POST', body: JSON.stringify(checkoutPayload) });
      checkoutId = String(checkout.id || ''); checkoutUrl = String(checkout.url || checkout.checkoutUrl || '');
    }
  } catch (error) {
    console.error('billing-create-checkout provider request failed', { officeId, priceCode, billingType, message: error instanceof Error ? error.message : String(error) });
    return json(request, { error: 'Não foi possível abrir o checkout agora. Tente novamente.', code: 'provider_checkout_failed' }, 502);
  }
  if (!checkoutUrl && billingType === 'BOLETO') return json(request, { error: 'A cobrança foi criada, mas o boleto ainda não está disponível. Consulte Plano e cobrança em instantes.', code: 'payment_link_pending', providerSubscriptionId }, 202);
  const { error: sessionError } = await admin.from('billing_checkout_sessions').insert({ id: sessionId, office_id: officeId, price_code: priceCode, provider_checkout_id: checkoutId || providerSubscriptionId, status: 'OPEN', billing_type: billingType, expires_at: periodEnd.toISOString(), created_by: userId });
  if (sessionError) return json(request, { error: 'Não foi possível registrar o checkout.', code: 'session_save_failed' }, 500);
  const { error: subscriptionError } = await admin.from('billing_subscriptions').insert({ office_id: officeId, customer_id: localCustomer?.id, provider: 'asaas', provider_subscription_id: providerSubscriptionId || null, price_code: priceCode, status: 'PENDING', billing_type: billingType, current_period_start: nextDueDate.toISOString(), current_period_end: periodEnd.toISOString(), next_due_date: nextDueDate.toISOString().slice(0, 10) });
  if (subscriptionError) console.error('billing-create-checkout local subscription projection failed', { officeId, message: subscriptionError.message });
  return new Response(JSON.stringify({ checkoutUrl, checkoutId: checkoutId || providerSubscriptionId, status: 'PENDING' }), { status: 201, headers: { ...getCorsHeaders(request), 'content-type': 'application/json', 'cache-control': 'no-store' } });
});
