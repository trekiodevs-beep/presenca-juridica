import { supabase } from '../lib/supabase';

const invoke = async (action: string) => {
  const { data, error } = await supabase.functions.invoke('privacy-controls', { body: { action } });
  if (error) throw error;
  return data as Record<string, unknown>;
};

export const exportOfficeData = async () => invoke('export') as Promise<{ officeId: string; exportedAt: string; data: Record<string, unknown[]> }>;
export const requestOfficeDeletion = async () => invoke('schedule-deletion') as Promise<{ deletionScheduledAt: string }>;
export const cancelOfficeDeletion = async () => invoke('cancel-deletion') as Promise<{ canceled: boolean }>;
