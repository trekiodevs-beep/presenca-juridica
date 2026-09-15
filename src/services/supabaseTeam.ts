import { supabase } from '../lib/supabase';
import type { Invitation, UserRole } from '../types';

const mapInvitation = (row: Record<string, unknown>): Omit<Invitation, 'tokenHash'> => ({
  id: String(row.id), officeId: String(row.office_id), email: String(row.email), role: row.role as UserRole,
  status: row.status as Invitation['status'], expiresAt: String(row.expires_at), createdBy: String(row.created_by),
  acceptedBy: row.accepted_by ? String(row.accepted_by) : null, acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
  createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const invoke = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('team-invitations', { body });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: unknown } | null;
      if (typeof payload?.error === 'string' && payload.error.trim()) throw new Error(payload.error);
    }
    throw new Error(error.message || 'Não foi possível concluir a operação de equipe.');
  }
  const response = (data || {}) as Record<string, unknown>;
  if (typeof response.error === 'string' && response.error.trim()) throw new Error(response.error);
  return response;
};

export const inviteMember = async (email: string, role: string) => invoke({ action: 'invite', email, role }) as Promise<{ invitationUrl: string; emailSent: boolean }>;
export const listPendingInvitations = async () => {
  const data = await invoke({ action: 'list' });
  return ((data.invitations || []) as Record<string, unknown>[]).map(mapInvitation);
};
export const resendInvitation = async (invitationId: string) => invoke({ action: 'resend', invitationId, email: '', role: 'assistant' }) as Promise<{ invitationUrl: string; emailSent: boolean }>;
export const revokeInvitation = async (invitationId: string) => invoke({ action: 'revoke', invitationId }) as Promise<{ status: string }>;
export const acceptInvitation = async (token: string) => invoke({ action: 'accept', token }) as Promise<{ officeId: string }>;
export const setMemberStatus = async (userId: string, status: 'active' | 'blocked' | 'removed') => invoke({ action: 'member-status', userId, status }) as Promise<{ status: string }>;
export const transferOwnership = async (userId: string) => invoke({ action: 'transfer-ownership', userId }) as Promise<{ officeId: string }>;
