import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import type { PlanCode } from '../types';
import type { Invitation } from '../types';

const functions = getFunctions(app, 'southamerica-east1');

export interface CheckoutResponse {
  checkoutUrl: string;
  subscriptionId?: string;
}

export interface BillingPayment {
  id: string;
  status: string;
  billingType: string;
  dueDate: string;
  value: number;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
}

export const createCheckout = async (planCode: Exclude<PlanCode, 'trial' | 'custom'>, cpfCnpj: string): Promise<CheckoutResponse> => {
  const callable = httpsCallable<{ planCode: string; cpfCnpj: string }, CheckoutResponse>(functions, 'createCheckout');
  const result = await callable({ planCode, cpfCnpj });
  return result.data;
};

export const changePlan = async (planCode: Exclude<PlanCode, 'trial' | 'custom'>): Promise<CheckoutResponse> => {
  const callable = httpsCallable<{ planCode: string }, CheckoutResponse>(functions, 'changePlan');
  const result = await callable({ planCode });
  return result.data;
};

export const cancelSubscription = async () => {
  const callable = httpsCallable<Record<string, never>, { status: string }>(functions, 'cancelSubscription');
  const result = await callable({});
  return result.data;
};

export const getBillingSummary = async () => {
  const callable = httpsCallable<Record<string, never>, { billingType: string | null; payments: BillingPayment[] }>(functions, 'getBillingSummary');
  return (await callable({})).data;
};

export const updateBillingMethod = async (billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD') => {
  const callable = httpsCallable<{ billingType: string }, { billingType: string }>(functions, 'updateBillingMethod');
  return (await callable({ billingType })).data;
};

export const inviteMember = async (email: string, role: string) => {
  const callable = httpsCallable<{ email: string; role: string }, { invitationUrl: string; emailSent: boolean }>(functions, 'inviteMember');
  const result = await callable({ email, role });
  return result.data;
};

export const listPendingInvitations = async () => {
  const callable = httpsCallable<Record<string, never>, { invitations: Array<Omit<Invitation, 'tokenHash'>> }>(functions, 'listPendingInvitations');
  return (await callable({})).data.invitations;
};

export const resendInvitation = async (invitationId: string) => {
  const callable = httpsCallable<{ invitationId: string }, { invitationUrl: string; emailSent: boolean }>(functions, 'resendInvitation');
  return (await callable({ invitationId })).data;
};

export const revokeInvitation = async (invitationId: string) => {
  const callable = httpsCallable<{ invitationId: string }, { status: string }>(functions, 'revokeInvitation');
  return (await callable({ invitationId })).data;
};

export const acceptInvitation = async (token: string) => {
  const callable = httpsCallable<{ token: string }, { officeId: string }>(functions, 'acceptInvitation');
  const result = await callable({ token });
  return result.data;
};

export const setMemberStatus = async (userId: string, status: 'active' | 'blocked' | 'removed') => {
  const callable = httpsCallable<{ userId: string; status: string }, { status: string }>(functions, 'setMemberStatus');
  const result = await callable({ userId, status });
  return result.data;
};

export const transferOwnership = async (userId: string) => {
  const callable = httpsCallable<{ userId: string }, { officeId: string }>(functions, 'transferOwnership');
  const result = await callable({ userId });
  return result.data;
};
