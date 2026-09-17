import type { CalendarEvent, ClientPortalAccess, DocumentCategory, FinancialRecord, Lead, LeadDocument, LeadEvent, Membership, PublicForm, PublicFormPublic, PublicLeadInput, Task, UsageCounter } from '../types';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const now = () => new Date().toISOString();

export const mapLead = (row: Record<string, unknown>): Lead => ({
  id: String(row.id), officeId: String(row.office_id), name: String(row.name || ''), phone: String(row.phone || ''),
  email: String(row.email || ''), city: String(row.city || ''), state: String(row.state || ''),
  source: row.source as Lead['source'], area: row.area as Lead['area'], status: row.status as Lead['status'],
  priority: row.priority as Lead['priority'], responsibleUserId: row.responsible_user_id ? String(row.responsible_user_id) : null,
  summary: String(row.summary || ''), notes: String(row.notes || ''), consentLgpd: Boolean(row.consent_lgpd),
  nextActionText: row.next_action_text ? String(row.next_action_text) : null,
  nextActionAt: row.next_action_at ? String(row.next_action_at) : null,
  lastWhatsappClickAt: row.last_whatsapp_click_at ? String(row.last_whatsapp_click_at) : null,
  archivedAt: row.archived_at ? String(row.archived_at) : null,
  createdVia: row.created_via ? String(row.created_via) : null,
  publicFormSlug: row.public_form_slug ? String(row.public_form_slug) : null,
  utmSource: row.utm_source ? String(row.utm_source) : null,
  utmMedium: row.utm_medium ? String(row.utm_medium) : null,
  utmCampaign: row.utm_campaign ? String(row.utm_campaign) : null,
  portalAccessEnabled: Boolean(row.portal_access_enabled), portalStatusLabel: row.portal_status_label ? String(row.portal_status_label) : null,
  portalNotes: row.portal_notes ? String(row.portal_notes) : null,
  createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const mapLeadEvent = (row: Record<string, unknown>): LeadEvent => ({
  id: String(row.id), officeId: String(row.office_id), leadId: String(row.lead_id), type: row.type as LeadEvent['type'],
  description: String(row.description || ''), createdBy: String(row.created_by || ''), createdAt: String(row.created_at),
  fromStatus: row.from_status ? row.from_status as LeadEvent['fromStatus'] : null,
  toStatus: row.to_status ? row.to_status as LeadEvent['toStatus'] : null,
  metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
});

const mapTask = (row: Record<string, unknown>): Task => ({
  id: String(row.id), officeId: String(row.office_id), leadId: String(row.lead_id), title: String(row.title || ''),
  dueAt: String(row.due_at), done: Boolean(row.done), createdAt: String(row.created_at),
  completedAt: row.completed_at ? String(row.completed_at) : undefined,
  responsibleUserId: row.responsible_user_id ? String(row.responsible_user_id) : null,
  createdBy: row.created_by ? String(row.created_by) : null,
});

const mapCalendarEvent = (row: Record<string, unknown>): CalendarEvent => ({
  id: String(row.id), officeId: String(row.office_id), leadId: row.lead_id ? String(row.lead_id) : null,
  title: String(row.title || ''), type: row.type as CalendarEvent['type'], status: row.status as CalendarEvent['status'],
  startAt: String(row.start_at), endAt: row.end_at ? String(row.end_at) : null,
  location: row.location ? String(row.location) : null, notes: row.notes ? String(row.notes) : null,
  responsibleUserId: row.responsible_user_id ? String(row.responsible_user_id) : null,
  externalProvider: row.external_provider ? row.external_provider as CalendarEvent['externalProvider'] : null,
  externalCalendarId: row.external_calendar_id ? String(row.external_calendar_id) : null,
  externalEventId: row.external_event_id ? String(row.external_event_id) : null,
  syncStatus: row.sync_status ? row.sync_status as CalendarEvent['syncStatus'] : undefined,
  syncError: row.sync_error ? String(row.sync_error) : null,
  lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
  origin: row.origin ? row.origin as CalendarEvent['origin'] : 'crm',
  googleEtag: row.google_etag ? String(row.google_etag) : null,
  googleUpdatedAt: row.google_updated_at ? String(row.google_updated_at) : null,
  lastLocalChangeAt: row.last_local_change_at ? String(row.last_local_change_at) : null,
  lastRemoteChangeAt: row.last_remote_change_at ? String(row.last_remote_change_at) : null,
  deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  attendees: Array.isArray(row.attendees) ? row.attendees as CalendarEvent['attendees'] : [],
  createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const throwPending = (operation: string): never => {
  throw new Error(`Operação Supabase ainda não migrada: ${operation}.`);
};

const mapPublicFormPublic = (row: Record<string, unknown>): PublicFormPublic => ({
  slug: String(row.slug), officeId: String(row.office_id), officeName: String(row.office_name || ''), lawyerName: String(row.lawyer_name || ''),
  whatsapp: String(row.whatsapp || ''), city: String(row.city || ''), state: String(row.state || ''),
  areas: Array.isArray(row.areas) ? row.areas as PublicFormPublic['areas'] : [], isActive: Boolean(row.is_active),
});

const mapMembership = (row: Record<string, unknown>): Membership => ({
  id: String(row.id), officeId: String(row.office_id), userId: String(row.user_id || ''), email: String(row.email || ''), name: String(row.name || ''),
  role: row.role as Membership['role'], status: row.status as Membership['status'], createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const mapDocument = (row: Record<string, unknown>): LeadDocument => ({
  id: String(row.id), officeId: String(row.office_id), leadId: String(row.lead_id), name: String(row.name || ''), fileName: String(row.file_name || ''),
  contentType: String(row.content_type || 'application/octet-stream'), size: Number(row.size || 0), storagePath: String(row.storage_path), downloadUrl: '',
  category: row.category as LeadDocument['category'], visibleInPortal: Boolean(row.visible_in_portal), uploadedBy: String(row.uploaded_by || ''), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const mapClientPortalAccess = (row: Record<string, unknown>): ClientPortalAccess => ({
  id: String(row.id), officeId: String(row.office_id), leadId: String(row.lead_id), clientName: String(row.client_name || ''),
  clientEmail: row.client_email ? String(row.client_email) : null, statusLabel: String(row.status_label || ''),
  publicNotes: row.public_notes ? String(row.public_notes) : null,
  pendingItems: Array.isArray(row.pending_items) ? row.pending_items as string[] : [],
  documents: Array.isArray(row.documents) ? row.documents as ClientPortalAccess['documents'] : [],
  appointments: Array.isArray(row.appointments) ? row.appointments as ClientPortalAccess['appointments'] : [],
  expiresAt: row.expires_at ? String(row.expires_at) : null,
  expiresAtMs: row.expires_at_ms ? Number(row.expires_at_ms) : null,
  isActive: Boolean(row.is_active), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const listen = <T>(table: string, officeId: string, map: (row: Record<string, unknown>) => T, callback: (items: T[]) => void, orderBy: string, fallbackIntervalMs = 60000) => {
  let active = true;
  let recoveryTimer: number | undefined;
  const refresh = async () => {
    const { data, error } = await supabase.from(table).select('*').eq('office_id', officeId).order(orderBy, { ascending: true });
    if (error) { console.error(`Supabase ${table} read failed:`, error); return; }
    if (active) callback((data || []).map(row => map(row as Record<string, unknown>)));
  };
  const scheduleRecovery = () => {
    if (!active || recoveryTimer !== undefined) return;
    recoveryTimer = window.setTimeout(() => { recoveryTimer = undefined; void refresh(); }, 30000);
  };
  void refresh();
  const channel = supabase.channel(`local-${table}-${officeId}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter: `office_id=eq.${officeId}` }, () => { void refresh(); })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') scheduleRecovery();
    });
  const recoveryInterval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, fallbackIntervalMs);
  const handleVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    active = false;
    if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
    window.clearInterval(recoveryInterval);
    document.removeEventListener('visibilitychange', handleVisibility);
    void supabase.removeChannel(channel);
  };
};

export const listenLeadsByOffice = (officeId: string, callback: (items: Lead[]) => void) => listen('leads', officeId, mapLead, callback, 'updated_at');
export const listenEventsByOffice = (officeId: string, callback: (items: LeadEvent[]) => void) => listen('lead_events', officeId, mapLeadEvent, callback, 'created_at');
export const listenTasksByOffice = (officeId: string, callback: (items: Task[]) => void) => listen('tasks', officeId, mapTask, callback, 'due_at');
// Calendar changes can also originate outside the CRM (Google webhook). Keep a
// short, bounded fallback in case a Realtime delivery is delayed or dropped.
export const listenCalendarEventsByOffice = (officeId: string, callback: (items: CalendarEvent[]) => void) => listen('calendar_events', officeId, mapCalendarEvent, callback, 'start_at', 10000);

export const listenDocumentsByOffice = (officeId: string, callback: (items: LeadDocument[]) => void) => listen('lead_documents', officeId, mapDocument, callback, 'created_at');
export const listenClientPortalAccessByOffice = (officeId: string, callback: (items: ClientPortalAccess[]) => void) => listen('client_portal_access', officeId, mapClientPortalAccess, callback, 'updated_at');

export const listenMembershipsByOffice = (officeId: string, callback: (items: Membership[]) => void) => listen('memberships', officeId, mapMembership, callback, 'created_at');

export const getUsageCounter = async (officeId: string): Promise<UsageCounter | null> => {
  const { data, error } = await supabase.from('usage_counters').select('*').eq('office_id', officeId).maybeSingle();
  if (error) throw error;
  return data ? { officeId: String(data.office_id), users: Number(data.users || 0), contacts: Number(data.contacts || 0), storageBytes: Number(data.storage_bytes || 0), storageReservedBytes: Number(data.storage_reserved_bytes || 0), refreshedAt: String(data.refreshed_at) } : null;
};

export const getPublicFormBySlug = async (slug: string): Promise<PublicFormPublic | null> => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug) || normalizedSlug.length > 120) return null;
  const { data, error } = await supabase.rpc('get_public_form_by_slug', { requested_slug: normalizedSlug });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapPublicFormPublic(row as Record<string, unknown>) : null;
};

export const updatePublicForm = async (slug: string, data: Partial<PublicForm>) => {
  const mapped: Record<string, unknown> = { updated_at: now() };
  const fields: Record<string, string> = { officeId: 'office_id', officeName: 'office_name', lawyerName: 'lawyer_name', isActive: 'is_active' };
  for (const [key, value] of Object.entries(data)) if (key !== 'slug' && key !== 'id') mapped[fields[key] || key] = value;
  const { error } = await supabase.from('public_forms').upsert({ slug, ...mapped }, { onConflict: 'slug' });
  if (error) throw error;
};

export const updateOffice = async (officeId: string, data: Partial<import('../types').Office>) => {
  const mapped: Record<string, unknown> = { updated_at: now() };
  const fields: Record<string, string> = { lawyerName: 'lawyer_name', whatsappMessageTemplate: 'whatsapp_message_template', ownerUserId: 'owner_user_id', planCode: 'plan_code', subscriptionStatus: 'subscription_status', trialStartedAt: 'trial_started_at', trialEndsAt: 'trial_ends_at', trialEndsAtMs: 'trial_ends_at_ms', onboardingCompletedAt: 'onboarding_completed_at', onboardingVersion: 'onboarding_version', deletionScheduledAt: 'deletion_scheduled_at' };
  for (const [key, value] of Object.entries(data)) if (key !== 'id' && key !== 'createdAt') mapped[fields[key] || key] = value;
  const { error } = await supabase.from('offices').update(mapped).eq('id', officeId);
  if (error) throw error;
};

export const createPublicLead = async (lead: PublicLeadInput): Promise<string> => {
  const normalizedSlug = lead.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug) || normalizedSlug.length > 120) {
    throw new Error('public_lead_creation_failed');
  }

  const { data, error } = await supabase.rpc('create_public_lead', {
    requested_slug: normalizedSlug,
    lead_name: lead.name,
    lead_phone: lead.phone,
    lead_email: lead.email,
    lead_city: lead.city,
    lead_state: lead.state,
    lead_area: lead.area,
    lead_summary: lead.summary,
    lead_consent_lgpd: lead.consentLgpd,
    lead_source: lead.source,
    lead_utm_source: lead.utmSource || null,
    lead_utm_medium: lead.utmMedium || null,
    lead_utm_campaign: lead.utmCampaign || null,
  });
  if (error) throw new Error('public_lead_creation_failed');

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.success !== true || !row.lead_id) throw new Error('public_lead_creation_failed');
  return String(row.lead_id);
};

export const getClientPortalAccessByToken = async (token: string): Promise<ClientPortalAccess | null> => {
  const { data, error } = await supabase.from('client_portal_access').select('*').eq('id', token).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapClientPortalAccess(data as Record<string, unknown>);
};

const mapFinancialRecord = (row: Record<string, unknown>): FinancialRecord => ({
  id: String(row.id), officeId: String(row.office_id), leadId: row.lead_id ? String(row.lead_id) : null,
  type: row.type as FinancialRecord['type'], status: row.status as FinancialRecord['status'], description: String(row.description || ''), amount: Number(row.amount || 0),
  dueAt: row.due_at ? String(row.due_at) : null, paidAt: row.paid_at ? String(row.paid_at) : null, paymentMethod: row.payment_method ? row.payment_method as FinancialRecord['paymentMethod'] : null,
  notes: row.notes ? String(row.notes) : null, proofDocumentId: row.proof_document_id ? String(row.proof_document_id) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

export const listenFinancialRecordsByOffice = (officeId: string, callback: (items: FinancialRecord[]) => void) => listen('financial_records', officeId, mapFinancialRecord, callback, 'due_at');

export const createFinancialRecord = async (record: Omit<FinancialRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data, error } = await supabase.from('financial_records').insert({ office_id: record.officeId, lead_id: record.leadId || null, type: record.type, status: record.status, description: record.description, amount: record.amount, due_at: record.dueAt || null, paid_at: record.paidAt || null, payment_method: record.paymentMethod || null, notes: record.notes || null, proof_document_id: record.proofDocumentId || null }).select('id').single();
  if (error) throw error;
  return String(data.id);
};

export const updateFinancialRecord = async (recordId: string, updates: Partial<FinancialRecord>) => {
  const mapped: Record<string, unknown> = { updated_at: now() };
  const fields: Record<string, string> = { officeId: 'office_id', leadId: 'lead_id', dueAt: 'due_at', paidAt: 'paid_at', paymentMethod: 'payment_method', proofDocumentId: 'proof_document_id' };
  for (const [key, value] of Object.entries(updates)) if (key !== 'id' && key !== 'createdAt') mapped[fields[key] || key] = value;
  const { error } = await supabase.from('financial_records').update(mapped).eq('id', recordId);
  if (error) throw error;
};

export const upsertClientPortalAccess = async (input: Omit<ClientPortalAccess, 'id' | 'createdAt' | 'updatedAt' | 'officeId'> & { officeId: string; id?: string }) => {
  const id = input.id || `portal-${crypto.randomUUID()}`;
  const payload = { id, office_id: input.officeId, lead_id: input.leadId, client_name: input.clientName, client_email: input.clientEmail || null, status_label: input.statusLabel, public_notes: input.publicNotes || null, pending_items: input.pendingItems || [], documents: input.documents || [], appointments: input.appointments || [], expires_at: input.expiresAt || null, expires_at_ms: input.expiresAtMs || null, is_active: input.isActive };
  const { error } = await supabase.from('client_portal_access').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  return id;
};

export const createLead = async (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data, error } = await supabase.from('leads').insert({
    office_id: lead.officeId, name: lead.name, phone: lead.phone, email: lead.email, city: lead.city, state: lead.state,
    source: lead.source, area: lead.area, status: lead.status, priority: lead.priority, responsible_user_id: lead.responsibleUserId || null,
    summary: lead.summary, notes: lead.notes, consent_lgpd: lead.consentLgpd, next_action_text: lead.nextActionText || null,
    next_action_at: lead.nextActionAt || null, created_via: lead.createdVia || null,
  }).select('id').single();
  if (error) throw error;
  return String(data.id);
};

export const updateLead = async (leadId: string, updates: Partial<Lead>, _currentUserId: string) => {
  const mapped: Record<string, unknown> = {};
  const fields: Record<string, string> = { officeId: 'office_id', responsibleUserId: 'responsible_user_id', consentLgpd: 'consent_lgpd', nextActionText: 'next_action_text', nextActionAt: 'next_action_at', lastWhatsappClickAt: 'last_whatsapp_click_at', archivedAt: 'archived_at', createdVia: 'created_via', publicFormSlug: 'public_form_slug', portalAccessEnabled: 'portal_access_enabled', portalStatusLabel: 'portal_status_label', portalNotes: 'portal_notes', createdAt: 'created_at', updatedAt: 'updated_at' };
  for (const [key, value] of Object.entries(updates)) if (key !== 'id' && key !== 'officeId') mapped[fields[key] || key] = value;
  mapped.updated_at = now();
  const { error } = await supabase.from('leads').update(mapped).eq('id', leadId);
  if (error) throw error;
};

export const addLeadEvent = async (event: Omit<LeadEvent, 'id' | 'createdAt'>) => {
  const { error } = await supabase.from('lead_events').insert({
    office_id: event.officeId,
    lead_id: event.leadId,
    type: event.type,
    description: event.description,
    created_by: event.createdBy,
    from_status: event.fromStatus || null,
    to_status: event.toStatus || null,
    metadata: event.metadata || {},
  });
  if (error) throw error;
};

export const createTask = async (task: Omit<Task, 'id' | 'createdAt'>) => {
  const { data, error } = await supabase.from('tasks').insert({
    office_id: task.officeId,
    lead_id: task.leadId,
    title: task.title,
    due_at: task.dueAt,
    done: task.done,
    completed_at: task.completedAt || null,
    responsible_user_id: task.responsibleUserId || null,
    created_by: task.createdBy || null,
  }).select('id').single();
  if (error) throw error;
  return String(data.id);
};

export const updateTask = async (taskId: string, updates: Partial<Task>) => {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) mapped[{ officeId: 'office_id', leadId: 'lead_id', dueAt: 'due_at', completedAt: 'completed_at', responsibleUserId: 'responsible_user_id', createdBy: 'created_by' }[key] || key] = value;
  const { error } = await supabase.from('tasks').update(mapped).eq('id', taskId);
  if (error) throw error;
};

export const createCalendarEvent = async (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data, error } = await supabase.from('calendar_events').insert({ office_id: event.officeId, lead_id: event.leadId || null, title: event.title, type: event.type, status: event.status, start_at: event.startAt, end_at: event.endAt || null, location: event.location || null, notes: event.notes || null, responsible_user_id: event.responsibleUserId || null, sync_status: 'not_connected' }).select('*').single();
  if (error) throw error;
  return mapCalendarEvent(data as Record<string, unknown>);
};

export const getOnboardingState = async () => {
  const { data, error } = await supabase.rpc('get_onboarding_state');
  if (error) throw error;
  return data as import('../types').OnboardingState;
};

export const createOnboardingExampleContact = async (): Promise<Lead> => {
  const { data, error } = await supabase.rpc('create_onboarding_example_contact');
  if (error) throw error;
  return mapLead(data as Record<string, unknown>);
};

export const updateCalendarEvent = async (eventId: string, updates: Partial<CalendarEvent>) => {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) mapped[{ officeId: 'office_id', leadId: 'lead_id', startAt: 'start_at', endAt: 'end_at', responsibleUserId: 'responsible_user_id', createdAt: 'created_at', updatedAt: 'updated_at' }[key] || key] = value;
  const { error } = await supabase.from('calendar_events').update(mapped).eq('id', eventId);
  if (error) throw error;
};

export const deleteCalendarEvent = async (eventId: string) => {
  const { data, error } = await supabase.functions.invoke('calendar-event-delete', { body: { eventId } });
  if (error) throw error;
  return data;
};

export class CalendarSyncRequestError extends Error {
  readonly status: number | null;
  readonly originalError: unknown;

  constructor(message: string, status: number | null, originalError: unknown) {
    super(message);
    this.name = 'CalendarSyncRequestError';
    this.status = status;
    this.originalError = originalError;
  }
}

export type GoogleCalendarOption = {
  id: string;
  summary: string;
  description: string | null;
  primary: boolean;
  accessRole: string;
};

export class GoogleCalendarSettingsError extends Error {
  readonly code: string | null;
  readonly status: number | null;

  constructor(message: string, code: string | null, status: number | null) {
    super(message);
    this.name = 'GoogleCalendarSettingsError';
    this.code = code;
    this.status = status;
  }
}

const calendarSettingsFailure = async (error: unknown, fallback: string): Promise<GoogleCalendarSettingsError> => {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    let code: string | null = null;
    let serverMessage = '';
    try {
      const payload = await error.context.clone().json() as { code?: unknown; error?: unknown };
      code = typeof payload.code === 'string' ? payload.code : null;
      serverMessage = typeof payload.error === 'string' ? payload.error : '';
    } catch {
      // Status-based fallback below remains safe for the customer.
    }
    console.error('Google Calendar settings function returned an HTTP error', { status, code, serverMessage, error });
    const message = code === 'google_reauthorization_required'
      ? 'Sua autorização Google precisa ser renovada. Use “Reconectar Google Agenda”.'
      : status === 401
        ? 'Sua sessão expirou. Entre novamente para continuar.'
        : status === 403
          ? 'Sua conta não possui permissão para alterar esta integração.'
          : status === 502
            ? 'O Google Agenda está temporariamente indisponível. Tente novamente em instantes.'
            : fallback;
    return new GoogleCalendarSettingsError(message, code, status);
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    console.error('Google Calendar settings function is unreachable', error);
    return new GoogleCalendarSettingsError('Não foi possível acessar o serviço do Google Agenda. Verifique sua conexão e tente novamente.', null, null);
  }
  console.error('Google Calendar settings operation failed unexpectedly', error);
  return new GoogleCalendarSettingsError(fallback, null, null);
};

export const listGoogleCalendars = async (): Promise<GoogleCalendarOption[]> => {
  const { data, error } = await supabase.functions.invoke('calendar-list', { body: {} });
  if (error) throw await calendarSettingsFailure(error, 'Não foi possível carregar suas agendas agora. Tente novamente.');
  return Array.isArray(data?.calendars) ? data.calendars as GoogleCalendarOption[] : [];
};

export const selectGoogleCalendar = async (calendar: Pick<GoogleCalendarOption, 'id' | 'summary'>) => {
  const { data, error } = await supabase.functions.invoke('calendar-select', { body: { calendarId: calendar.id, calendarName: calendar.summary } });
  if (error) throw await calendarSettingsFailure(error, 'Não foi possível selecionar esta agenda. Tente novamente.');
  return data as { connection: { calendar_id: string; calendar_name: string; status: string }; syncQueued: boolean };
};

export const disconnectGoogleCalendar = async () => {
  const { data, error } = await supabase.functions.invoke('calendar-disconnect', { body: {} });
  if (error) throw await calendarSettingsFailure(error, 'Não foi possível desconectar o Google Agenda. Tente novamente.');
  return data as { disconnected: boolean; googleRevoked: boolean; alreadyDisconnected?: boolean };
};

export const syncCalendarNow = async () => {
  const { data, error } = await supabase.functions.invoke('calendar-sync-now', { body: {} });
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    let serverMessage = '';
    try {
      const payload = await error.context.clone().json() as { error?: unknown };
      serverMessage = typeof payload.error === 'string' ? payload.error : '';
    } catch {
      // The HTTP status remains sufficient to produce a safe user-facing message.
    }
    const message = status === 401
      ? 'Sua sessão expirou. Entre novamente para sincronizar a agenda.'
      : status === 403
        ? 'Sua conta não possui permissão para sincronizar esta agenda.'
        : status === 412
          ? 'Conecte e selecione uma agenda Google antes de sincronizar.'
          : status === 429
            ? 'Há uma sincronização em andamento. Aguarde um instante e tente novamente.'
            : 'Não foi possível sincronizar a agenda agora. Tente novamente.';
    console.error('calendar-sync-now returned an HTTP error', { status, serverMessage, error });
    throw new CalendarSyncRequestError(message, status, error);
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    console.error('calendar-sync-now could not reach the Edge Function', error);
    throw new CalendarSyncRequestError('Não foi possível acessar o serviço de sincronização. Verifique sua conexão e tente novamente.', null, error);
  }
  if (error) {
    console.error('calendar-sync-now failed unexpectedly', error);
    throw new CalendarSyncRequestError('Não foi possível sincronizar a agenda agora. Tente novamente.', null, error);
  }
  return data as { syncRunId: string; status: string; queued: number };
};

export const resolveCalendarConflict = async (eventId: string, decision: 'crm' | 'google' | 'manual') => {
  const { data, error } = await supabase.functions.invoke('calendar-conflict-resolve', { body: { eventId, decision } });
  if (error) throw error;
  return data;
};

export const uploadLeadDocument = async (input: { officeId: string; leadId: string; file: File; category: DocumentCategory; visibleInPortal: boolean; uploadedBy: string }): Promise<string> => {
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${input.officeId}/${input.leadId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('lead-documents').upload(storagePath, input.file, { contentType: input.file.type || 'application/octet-stream', upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.from('lead_documents').insert({ office_id: input.officeId, lead_id: input.leadId, name: input.file.name, file_name: input.file.name, content_type: input.file.type || 'application/octet-stream', size: input.file.size, storage_path: storagePath, category: input.category, visible_in_portal: input.visibleInPortal, uploaded_by: input.uploadedBy }).select('id').single();
  if (error) {
    await supabase.storage.from('lead-documents').remove([storagePath]);
    throw error;
  }
  return String(data.id);
};

export const getDocumentDownloadUrl = async (documentId: string, portalToken?: string) => {
  if (portalToken) {
    const { data, error } = await supabase.functions.invoke('portal-document-download', { body: { portalToken, documentId } });
    if (error) throw error;
    if (!data?.downloadUrl) throw new Error('Documento não encontrado ou não autorizado.');
    return { downloadUrl: String(data.downloadUrl) };
  }
  let storagePath: string | null = null;
  const { data: document, error } = await supabase.from('lead_documents').select('storage_path').eq('id', documentId).maybeSingle();
  if (error) throw error;
  storagePath = document ? String(document.storage_path) : null;
  if (!storagePath) throw new Error('Documento não encontrado ou não publicado no portal.');
  const { data, error: signedUrlError } = await supabase.storage.from('lead-documents').createSignedUrl(storagePath, 300);
  if (signedUrlError || !data?.signedUrl) throw signedUrlError || new Error('Não foi possível gerar a URL segura.');
  return { downloadUrl: data.signedUrl };
};
