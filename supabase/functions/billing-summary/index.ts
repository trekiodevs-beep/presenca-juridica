import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { asaasRequest, getBillingContext, json, normalizeBillingError, safeAsaasUrl, sanitizedAsaasError } from '../_shared/billing.ts';

Deno.serve(async request => {
  const cors = handleCors(request); if (cors) return cors;
  if (request.method !== 'GET') return json(request, { error: 'Método não permitido.' }, 405);
  const context = await getBillingContext(request); const contextError = await normalizeBillingError(request, context); if (contextError) return new Response(contextError.body, { status: contextError.status, headers: { ...getCorsHeaders(request), 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const { admin, officeId } = context;
  const [{ data: office }, { data: subscription }, { data: payments, error: paymentsError }] = await Promise.all([
    admin.from('offices').select('product_code, price_code, subscription_status, billing_current_period_start, billing_current_period_end, billing_cancel_at_period_end').eq('id', officeId).maybeSingle(),
    admin.from('billing_subscriptions').select('id, price_code, status, billing_type, provider_subscription_id, provider_snapshot, current_period_start, current_period_end, cancel_at_period_end, next_due_date').eq('office_id', officeId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('billing_payments').select('id, status, billing_type, amount_cents, due_date, paid_at, invoice_url, bank_slip_url').eq('office_id', officeId).order('due_date', { ascending: false }).limit(24),
  ]);
  if (!office) return json(request, { error: 'Escritório não encontrado.' }, 404);
  if (paymentsError) return json(request, { error: 'Não foi possível carregar as cobranças.', code: 'payments_query_failed' }, 500);
  let pending: { priceCode: string; billingType: string | null; checkoutUrl: string | null; expiresAt: string | null; pixPayload: string | null; pixImage: string | null } | null = null;
  if (subscription?.status === 'PENDING') {
    const { data: session } = await admin.from('billing_checkout_sessions').select('status, expires_at').eq('subscription_id', subscription.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    let checkoutUrl = '';
    let pixPayload = '';
    let pixImage = '';
    if (subscription.billing_type === 'CREDIT_CARD' && session?.status === 'OPEN' && session.expires_at && new Date(session.expires_at).getTime() > Date.now()) checkoutUrl = safeAsaasUrl(subscription.provider_snapshot?.link);
    if (['PIX', 'BOLETO'].includes(String(subscription.billing_type)) && subscription.provider_subscription_id) {
      const providerPayments = await asaasRequest(`subscriptions/${encodeURIComponent(String(subscription.provider_subscription_id))}/payments`).catch(error => {
        console.error('billing summary payment lookup failed', { officeId, ...sanitizedAsaasError(error) });
        return null;
      });
      const firstPayment = providerPayments && Array.isArray(providerPayments.data) ? providerPayments.data[0] : null;
      checkoutUrl = safeAsaasUrl(firstPayment?.invoiceUrl || firstPayment?.bankSlipUrl);
      if (subscription.billing_type === 'PIX' && firstPayment?.id) {
        const qr = await asaasRequest(`payments/${encodeURIComponent(String(firstPayment.id))}/pixQrCode`).catch(error => {
          console.error('billing summary Pix QR lookup failed', { officeId, ...sanitizedAsaasError(error) });
          return null;
        });
        pixPayload = String(qr?.payload || '');
        pixImage = String(qr?.encodedImage || '');
      }
    }
    pending = { priceCode: subscription.price_code, billingType: subscription.billing_type, checkoutUrl: checkoutUrl || null, expiresAt: session?.expires_at || null, pixPayload: pixPayload || null, pixImage: pixImage || null };
  }
  return json(request, { productCode: office.product_code, priceCode: subscription?.price_code || office.price_code, status: subscription?.status || office.subscription_status, billingType: subscription?.billing_type || null, currentPeriodStart: subscription?.current_period_start || office.billing_current_period_start, currentPeriodEnd: subscription?.current_period_end || office.billing_current_period_end, cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end || office.billing_cancel_at_period_end), nextDueDate: subscription?.next_due_date || null, pending, payments: (payments || []).map(payment => ({ id: payment.id, status: payment.status, billingType: payment.billing_type, amountCents: payment.amount_cents, dueDate: payment.due_date, paidAt: payment.paid_at, invoiceUrl: payment.invoice_url, bankSlipUrl: payment.bank_slip_url })) });
});
