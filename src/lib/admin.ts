import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import type { Office, SubscriptionStatus } from '../types';

const functions = getFunctions(app, 'southamerica-east1');

export const exportOfficeData = async () => {
  const callable = httpsCallable<Record<string, never>, { officeId: string; exportedAt: string; data: Record<string, unknown[]> }>(functions, 'exportOfficeData');
  return (await callable({})).data;
};

export const requestOfficeDeletion = async () => {
  const callable = httpsCallable<Record<string, never>, { deletionScheduledAt: string }>(functions, 'requestOfficeDeletion');
  return (await callable({})).data;
};

export const cancelOfficeDeletion = async () => {
  const callable = httpsCallable<Record<string, never>, { canceled: boolean }>(functions, 'cancelOfficeDeletion');
  return (await callable({})).data;
};

export const listPlatformOffices = async () => {
  const callable = httpsCallable<Record<string, never>, { offices: Office[] }>(functions, 'listPlatformOffices');
  return (await callable({})).data;
};

export const setPlatformOfficeStatus = async (officeId: string, status: SubscriptionStatus) => {
  const callable = httpsCallable<{ officeId: string; status: SubscriptionStatus }, { status: string }>(functions, 'setPlatformOfficeStatus');
  return (await callable({ officeId, status })).data;
};

export interface SupportAccessRequest {
  id: string;
  officeId: string;
  requestedBy: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  requestedAt: string;
  expiresAtMs?: number | null;
}

export const requestSupportAccess = async (officeId: string, reason: string) => {
  const callable = httpsCallable<{ officeId: string; reason: string }, { requestId: string }>(functions, 'requestSupportAccess');
  return (await callable({ officeId, reason })).data;
};

export const listSupportAccessRequests = async () => {
  const callable = httpsCallable<Record<string, never>, { requests: SupportAccessRequest[] }>(functions, 'listSupportAccessRequests');
  return (await callable({})).data.requests;
};

export const decideSupportAccess = async (requestId: string, decision: 'approved' | 'denied' | 'revoked') => {
  const callable = httpsCallable<{ requestId: string; decision: string }, { status: string; expiresAtMs: number | null }>(functions, 'decideSupportAccess');
  return (await callable({ requestId, decision })).data;
};

export const getSupportOfficeSnapshot = async (requestId: string) => {
  const callable = httpsCallable<{ requestId: string }, { office: Office; usage: Record<string, number> | null; counts: { leads: number; tasks: number }; accessExpiresAtMs: number }>(functions, 'getSupportOfficeSnapshot');
  return (await callable({ requestId })).data;
};

export interface OperationsInboxItem { id: string; officeId?: string | null; email?: string | null; subject?: string; message?: string; requestType?: string; details?: string; status: string; createdAt: string; }

export const listOperationsInbox = async () => {
  const callable = httpsCallable<Record<string, never>, { privacyRequests: OperationsInboxItem[]; supportTickets: OperationsInboxItem[]; integrationErrors: OperationsInboxItem[] }>(functions, 'listOperationsInbox');
  return (await callable({})).data;
};

export interface PlatformMetrics { totalOffices: number; active: number; trials: number; canceled: number; activated: number; activationRate: number; conversionRate: number; mrr: number; }
export const getPlatformMetrics = async () => {
  const callable = httpsCallable<Record<string, never>, PlatformMetrics>(functions, 'getPlatformMetrics');
  return (await callable({})).data;
};

export const updateOperationsInboxItem = async (kind: 'privacy' | 'support', id: string, status: string, resolutionNote = '') => {
  const callable = httpsCallable<{ kind: string; id: string; status: string; resolutionNote: string }, { status: string }>(functions, 'updateOperationsInboxItem');
  return (await callable({ kind, id, status, resolutionNote })).data;
};
