import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { PlanCode } from '../types';

export interface CheckoutResponse { checkoutUrl: string; checkoutId?: string; }
export interface BillingPayment { id: string; status: string; billingType: string | null; dueDate: string | null; value: number; invoiceUrl: string | null; bankSlipUrl: string | null; paidAt?: string | null; }
export interface BillingSummary { productCode: string; priceCode: string | null; status: string; billingType: string | null; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; nextDueDate: string | null; payments: BillingPayment[]; }

const billingError = async (error: unknown, fallback: string) => {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    if (status === 401) return new Error('Sua sessão expirou. Entre novamente para continuar.');
    if (status === 403) return new Error('Sua conta não possui permissão para gerenciar a assinatura.');
    if (status === 409) return new Error('Este plano está temporariamente indisponível. Tente novamente.');
    if (status === 502) return new Error('O serviço de pagamento está temporariamente indisponível. Tente novamente em instantes.');
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) return new Error('Não foi possível acessar o serviço de pagamento. Verifique sua conexão e tente novamente.');
  return new Error(fallback);
};

export const createCheckout = async (priceCode: string, cpfCnpj: string, billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' = 'CREDIT_CARD'): Promise<CheckoutResponse> => {
  const { data, error } = await supabase.functions.invoke('billing-create-checkout', { body: { priceCode, billingType, payer: { cpfCnpj } } });
  if (error) throw await billingError(error, 'Não foi possível iniciar o pagamento. Tente novamente.');
  return data as CheckoutResponse;
};
export const changePlan = async (priceCode: string) => {
  const { data, error } = await supabase.functions.invoke('billing-change-plan', { body: { priceCode } });
  if (error) throw await billingError(error, 'Não foi possível alterar o plano. Tente novamente.');
  return data as { priceCode: string; status: string; effective: 'pending_and_future_charges' };
};
export const getBillingSummary = async (): Promise<BillingSummary> => {
  const { data, error } = await supabase.functions.invoke('billing-summary', { method: 'GET' });
  if (error) throw await billingError(error, 'Não foi possível carregar as cobranças. Tente novamente.');
  const payload = data as Record<string, unknown>;
  return { ...payload, payments: Array.isArray(payload.payments) ? payload.payments.map((payment: any) => ({ ...payment, value: Number(payment.amountCents || 0) / 100, dueDate: payment.dueDate || null })) : [] } as BillingSummary;
};
export const updateBillingMethod = async (billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD') => {
  const { data, error } = await supabase.functions.invoke('billing-update-method', { body: { billingType } });
  if (error) throw await billingError(error, 'Não foi possível alterar a forma de pagamento. Tente novamente.');
  return data as { billingType: string; status: string };
};
export const cancelSubscription = async () => {
  const { data, error } = await supabase.functions.invoke('billing-cancel-subscription', { body: {} });
  if (error) throw await billingError(error, 'Não foi possível cancelar a renovação. Tente novamente.');
  return data as { status: string; effectiveAt: string; protocol: string };
};
