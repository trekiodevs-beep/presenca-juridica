import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import type { Lead } from '../types';

const functions = getFunctions(app, 'southamerica-east1');

export const createInternalLead = async (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => {
  const callable = httpsCallable<Record<string, unknown>, { leadId: string }>(functions, 'createInternalLead');
  return (await callable(lead as unknown as Record<string, unknown>)).data.leadId;
};

export const createPublicLeadCallable = async (lead: Record<string, unknown>) => {
  const callable = httpsCallable<Record<string, unknown>, { leadId: string }>(functions, 'createPublicLead');
  return (await callable(lead)).data.leadId;
};
