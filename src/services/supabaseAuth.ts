import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { Office, User, UserRole } from '../types';
import { getPlanLimits } from '../lib/plans';
import { supabase } from '../lib/supabase';

const mapProfile = (profile: Record<string, unknown>): User => ({
  id: String(profile.id),
  name: String(profile.name || ''),
  email: String(profile.email || ''),
  role: (String(profile.role || 'admin') as UserRole),
  officeId: String(profile.office_id || ''),
  createdAt: String(profile.created_at),
  updatedAt: profile.updated_at ? String(profile.updated_at) : undefined,
  photoURL: profile.photo_url ? String(profile.photo_url) : null,
  globalRole: profile.global_role ? 'platform_admin' : null,
  acceptedTermsVersion: profile.accepted_terms_version ? String(profile.accepted_terms_version) : null,
  acceptedTermsAt: profile.accepted_terms_at ? String(profile.accepted_terms_at) : null,
  acceptedPrivacyVersion: profile.accepted_privacy_version ? String(profile.accepted_privacy_version) : null,
  acceptedPrivacyAt: profile.accepted_privacy_at ? String(profile.accepted_privacy_at) : null,
});

const mapOffice = (office: Record<string, unknown>): Office => ({
  id: String(office.id),
  name: String(office.name || ''),
  lawyerName: String(office.lawyer_name || ''),
  oab: String(office.oab || ''),
  city: String(office.city || ''),
  state: String(office.state || ''),
  whatsapp: String(office.whatsapp || ''),
  whatsappMessageTemplate: office.whatsapp_message_template ? String(office.whatsapp_message_template) : null,
  email: String(office.email || ''),
  areas: Array.isArray(office.areas) ? office.areas as Office['areas'] : [],
  slug: office.slug ? String(office.slug) : undefined,
  subscriptionStatus: office.subscription_status as Office['subscriptionStatus'],
  planCode: office.plan_code as Office['planCode'],
  priceCode: office.price_code ? String(office.price_code) : null,
  billingCustomerId: office.billing_customer_id ? String(office.billing_customer_id) : null,
  billingSubscriptionId: office.billing_subscription_id ? String(office.billing_subscription_id) : null,
  billingProvider: office.billing_provider === 'asaas' ? 'asaas' : null,
  trialStartedAt: office.trial_started_at ? String(office.trial_started_at) : null,
  trialEndsAt: office.trial_ends_at ? String(office.trial_ends_at) : null,
  trialEndsAtMs: office.trial_ends_at_ms ? Number(office.trial_ends_at_ms) : null,
  graceEndsAt: office.grace_ends_at ? String(office.grace_ends_at) : null,
  graceEndsAtMs: office.grace_ends_at_ms ? Number(office.grace_ends_at_ms) : null,
  ownerUserId: office.owner_user_id ? String(office.owner_user_id) : undefined,
  onboardingCompletedAt: office.onboarding_completed_at ? String(office.onboarding_completed_at) : null,
  onboardingVersion: Number(office.onboarding_version || 1),
  limits: (office.limits || getPlanLimits('trial')) as Office['limits'],
  deletionScheduledAt: office.deletion_scheduled_at ? String(office.deletion_scheduled_at) : null,
  createdAt: String(office.created_at),
  updatedAt: String(office.updated_at),
});

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
};

export const signOutSupabase = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getSupabaseSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const subscribeSupabaseAuth = (callback: (event: AuthChangeEvent, session: Session | null) => void) =>
  supabase.auth.onAuthStateChange(callback).data.subscription;

export const getOrCreateSupabaseUser = async (authUser: SupabaseUser): Promise<User> => {
  const metadata = authUser.user_metadata || {};
  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return mapProfile(existing);

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert({
      id: authUser.id,
      name: String(metadata.full_name || metadata.name || ''),
      email: authUser.email || '',
      photo_url: metadata.avatar_url || null,
    })
    .select('*')
    .single();
  if (createError) throw createError;
  return mapProfile(created);
};

export const getSupabaseOfficeById = async (officeId: string): Promise<Office | null> => {
  if (!officeId) return null;
  const { data, error } = await supabase.from('offices').select('*').eq('id', officeId).maybeSingle();
  if (error) throw error;
  return data ? mapOffice(data) : null;
};

export const createSupabaseOffice = async (input: Omit<Office, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error('Usuário não autenticado.');
  const user = authData.user;
  const { data: office, error } = await supabase.rpc('create_office_with_owner', {
    input: {
      name: input.name,
      lawyerName: input.lawyerName,
      oab: input.oab,
      city: input.city,
      state: input.state,
      whatsapp: input.whatsapp,
      email: input.email,
      areas: input.areas,
      slug: input.slug || null,
    },
  });
  if (error) throw error;
  return { id: office.id, office: mapOffice(office) };
};

export const acceptSupabaseLegalTerms = async (userId: string, version: string) => {
  if (!userId) throw new Error('Usuário não autenticado.');
  const acceptedAt = new Date().toISOString();
  const { error } = await supabase.from('profiles').update({
    accepted_terms_version: version,
    accepted_terms_at: acceptedAt,
    accepted_privacy_version: version,
    accepted_privacy_at: acceptedAt,
  }).eq('id', userId);
  if (error) throw error;
  return { acceptedAt };
};

export const recordSupabaseLoginEvent = async () => {
  const { data, error } = await supabase.rpc('record_audit_event', { action_name: 'auth.login', target_type_name: 'user' });
  if (error) throw error;
  return { recordedAt: String(data.created_at) };
};
