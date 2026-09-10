import { supabase } from '../lib/supabase';
import type { Office } from '../types';

export interface SupportAccessRequest { id: string; officeId: string; requestedBy: string; reason: string; status: 'pending' | 'approved' | 'denied' | 'revoked'; requestedAt: string; expiresAtMs?: number | null; }
const map = (row: Record<string, unknown>): SupportAccessRequest => ({ id: String(row.id), officeId: String(row.office_id), requestedBy: String(row.requested_by), reason: String(row.reason), status: row.status as SupportAccessRequest['status'], requestedAt: String(row.requested_at), expiresAtMs: row.expires_at ? Date.parse(String(row.expires_at)) : null });
const invoke = async (body: Record<string, unknown>) => { const { data, error } = await supabase.functions.invoke('support-access', { body }); if (error) throw error; return data as Record<string, unknown>; };
export const listSupportAccessRequests = async () => { const data = await invoke({ action: 'list' }); return ((data.requests || []) as Record<string, unknown>[]).map(map); };
export const decideSupportAccess = async (requestId: string, decision: 'approved' | 'denied' | 'revoked') => invoke({ action: 'decide', requestId, decision }) as Promise<{ status: string; expiresAtMs: number | null }>;
export const requestSupportAccess = async (officeId: string, reason: string) => invoke({ action: 'request', officeId, reason }) as Promise<{ requestId: string }>;
export const getSupportOfficeSnapshot = async (requestId: string) => invoke({ action: 'snapshot', requestId });
export type { Office };
