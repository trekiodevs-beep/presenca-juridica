import { supabase } from '../lib/supabase';

const invoke = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('support-requests', { body });
  if (error) throw error;
  return data as Record<string, string>;
};

export const submitSupportTicket = async (input: { subject: string; message: string }) => invoke({ kind: 'support', ...input }) as Promise<{ ticketId: string }>;
export const submitPrivacyRequest = async (input: { email: string; requestType: string; details: string }) => invoke({ kind: 'privacy', ...input }) as Promise<{ protocol: string }>;
