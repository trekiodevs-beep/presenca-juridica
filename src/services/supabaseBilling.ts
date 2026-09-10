import { supabase } from '../lib/supabase';
import { updateOffice } from './supabaseDb';
import type { PlanCode } from '../types';

export interface CheckoutResponse { checkoutUrl: string; subscriptionId?: string; }
export interface BillingPayment { id: string; status: string; billingType: string; dueDate: string; value: number; invoiceUrl: string | null; bankSlipUrl: string | null; }
const providerNotConfigured = () => { throw new Error('Provedor de cobrança ainda não configurado.'); };
export const createCheckout = async (_planCode: Exclude<PlanCode, 'trial' | 'custom'>, _cpfCnpj: string): Promise<CheckoutResponse> => providerNotConfigured();
export const changePlan = async (_planCode: Exclude<PlanCode, 'trial' | 'custom'>): Promise<CheckoutResponse> => providerNotConfigured();
export const getBillingSummary = async () => ({ billingType: null as string | null, payments: [] as BillingPayment[] });
export const updateBillingMethod = async (_billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD') => providerNotConfigured();
export const cancelSubscription = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Autenticação obrigatória.');
  const { data: profile, error } = await supabase.from('profiles').select('office_id, role').eq('id', user.id).maybeSingle();
  if (error || !profile?.office_id || !['owner', 'admin'].includes(String(profile.role))) throw new Error('Permissão insuficiente.');
  await updateOffice(profile.office_id, { subscriptionStatus: 'CANCELED' });
  return { status: 'CANCELED' };
};
