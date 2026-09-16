export type LeadSource = 
  | 'Landing Page'
  | 'Site'
  | 'WhatsApp'
  | 'Instagram'
  | 'Indicação'
  | 'Cadastro Manual'
  | 'Outro';

export type LegalArea =
  | 'Direito de Família'
  | 'Direito Previdenciário'
  | 'Direito Trabalhista'
  | 'Direito Civil'
  | 'Direito do Consumidor'
  | 'Direito Imobiliário'
  | 'Direito Empresarial'
  | 'Direito Sucessório'
  | 'Direito Contratual'
  | 'Direito Tributário'
  | 'Outro';

export type LeadStatus =
  | 'Novo contato'
  | 'Aguardando triagem'
  | 'Triagem realizada'
  | 'Aguardando informações'
  | 'Consulta agendada'
  | 'Proposta enviada'
  | 'Contratado'
  | 'Não avançou'
  | 'Arquivado';

export type Priority = 'Baixa' | 'Média' | 'Alta';

export type DocumentCategory =
  | 'Identificação'
  | 'Contrato'
  | 'Procuração'
  | 'Comprovante'
  | 'Peça processual'
  | 'Outro';

export type CalendarEventType =
  | 'Consulta'
  | 'Retorno'
  | 'Prazo'
  | 'Audiência'
  | 'Reunião'
  | 'Outro';

export type CalendarEventStatus =
  | 'Agendado'
  | 'Concluído'
  | 'Cancelado';

export type FinancialRecordType =
  | 'Consulta'
  | 'Honorários'
  | 'Entrada'
  | 'Parcela'
  | 'Despesa'
  | 'Êxito'
  | 'Outro';

export type FinancialRecordStatus =
  | 'Previsto'
  | 'Em aberto'
  | 'Pago'
  | 'Vencido'
  | 'Cancelado';

export type PaymentMethod =
  | 'Pix'
  | 'Boleto manual'
  | 'Cartão externo'
  | 'Dinheiro'
  | 'Transferência'
  | 'Outro';

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELED'
  | 'EXPIRED';

export type PlanCode = 'trial' | 'core' | 'essential' | 'professional' | 'custom';

export type UserRole = 'owner' | 'admin' | 'lawyer' | 'assistant' | 'finance' | 'read';

export type Permission =
  | 'office.manage'
  | 'billing.manage'
  | 'members.manage'
  | 'contacts.read'
  | 'contacts.write'
  | 'tasks.write'
  | 'calendar.write'
  | 'finance.read'
  | 'finance.write'
  | 'documents.write'
  | 'portal.write'
  | 'export.read';

export type AlarmSourceType =
  | 'LEAD'
  | 'TASK'
  | 'CALENDAR_EVENT'
  | 'FINANCIAL_RECORD'
  | 'CALENDAR_INTEGRATION'
  | 'OFFICE'
  | 'SUPPORT_REQUEST';

export type AlarmSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type OperationalAlarmState = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELED';

export type AlarmRecipientReason = 'ASSIGNEE' | 'OWNER' | 'ADMIN' | 'FINANCE' | 'FALLBACK';

export type OperationalAlarmEventType = 'CREATED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELED' | 'REOPENED' | 'EVALUATED';

export interface OperationalAlarm {
  id: string;
  officeId: string;
  sourceType: AlarmSourceType;
  sourceId?: string | null;
  ruleCode: string;
  cycleKey: string;
  severity: AlarmSeverity;
  state: OperationalAlarmState;
  assignedUserId?: string | null;
  title: string;
  message: string;
  actionPath?: string | null;
  baseAt?: string | null;
  dueAt?: string | null;
  triggeredAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionCode?: string | null;
  resolvedAutomatically: boolean;
  metadata: Record<string, unknown>;
  ruleVersion: number;
  version: number;
  lastEvaluatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalAlarmRecipient {
  alarmId: string;
  officeId: string;
  userId: string;
  deliveryReason: AlarmRecipientReason;
  readAt?: string | null;
  snoozedUntil?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalAlarmEvent {
  id: string;
  alarmId: string;
  officeId: string;
  eventType: OperationalAlarmEventType;
  fromState?: OperationalAlarmState | null;
  toState?: OperationalAlarmState | null;
  actorUserId?: string | null;
  reason?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  officeId: string;
  createdAt: string;
  updatedAt?: string;
  photoURL?: string | null;
  globalRole?: 'platform_admin' | null;
  acceptedTermsVersion?: string | null;
  acceptedTermsAt?: string | null;
  acceptedPrivacyVersion?: string | null;
  acceptedPrivacyAt?: string | null;
}

export interface Office {
  id: string;
  name: string;
  lawyerName: string;
  oab: string;
  city: string;
  state: string;
  whatsapp: string;
  whatsappMessageTemplate?: string | null;
  email: string;
  areas: LegalArea[];
  slug?: string;
  subscriptionStatus?: SubscriptionStatus;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  subscriptionUpdatedAt?: string | null;
  planCode?: PlanCode;
  trialEndsAtMs?: number | null;
  graceEndsAt?: string | null;
  graceEndsAtMs?: number | null;
  ownerUserId?: string;
  onboardingCompletedAt?: string | null;
  onboardingVersion?: number;
  limits?: PlanLimits;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
  billingProvider?: 'asaas' | null;
  priceCode?: string | null;
  deletionScheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OnboardingMilestones = {
  officeReady: boolean;
  firstContactReady: boolean;
  firstActionReady: boolean;
};

export type OnboardingRecommendation = {
  key: string;
  label: string;
  href: string;
  optional?: boolean;
};

export type OnboardingState = {
  version: number;
  officeId: string;
  milestones: OnboardingMilestones;
  optional: { googleCalendarConnected: boolean };
  nextAction: 'office' | 'first_contact' | 'first_action' | 'activated';
  recommendations: OnboardingRecommendation[];
};

export interface PlanLimits {
  maxUsers: number;
  maxContacts: number;
  maxStorageBytes: number;
}

export interface Plan {
  code: PlanCode;
  name: string;
  audience: string;
  priceCents: number | null;
  interval: 'month' | null;
  limits: PlanLimits;
  features: string[];
}

export interface Membership {
  id: string;
  officeId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'invited' | 'blocked' | 'removed';
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  officeId: string;
  email: string;
  role: UserRole;
  tokenHash: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdBy: string;
  acceptedBy?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  officeId: string;
  planCode: PlanCode;
  status: SubscriptionStatus;
  provider: 'asaas';
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  nextDueDate?: string | null;
  canceledAt?: string | null;
  updatedAt: string;
}

export interface BillingEvent {
  id: string;
  provider: 'asaas';
  eventType: string;
  externalId: string;
  officeId?: string | null;
  status: 'received' | 'processed' | 'ignored' | 'failed';
  receivedAt: string;
  processedAt?: string | null;
  error?: string | null;
}

export interface UsageCounter {
  officeId: string;
  users: number;
  contacts: number;
  storageBytes: number;
  storageReservedBytes?: number;
  refreshedAt: string;
}

export interface AuditLog {
  id: string;
  officeId?: string | null;
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface PublicForm {
  slug: string;
  officeId: string;
  officeName: string;
  lawyerName: string;
  whatsapp: string;
  email: string;
  city: string;
  state: string;
  areas: LegalArea[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicFormPublic {
  slug: string;
  officeId: string;
  officeName: string;
  lawyerName: string;
  whatsapp: string;
  city: string;
  state: string;
  areas: LegalArea[];
  isActive: boolean;
}

export type PublicLeadSource = LeadSource | 'Formulário Público';

export interface PublicLeadInput {
  slug: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  area: LegalArea;
  summary: string;
  consentLgpd: boolean;
  source: PublicLeadSource;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

export interface Lead {
  id: string;
  officeId: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  source: LeadSource;
  area: LegalArea;
  status: LeadStatus;
  priority: Priority;
  responsibleUserId?: string | null;
  summary: string;
  notes: string;
  consentLgpd: boolean;
  nextActionText?: string | null;
  nextActionAt?: string | null;
  lastWhatsappClickAt?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  createdVia?: string | null;
  publicFormSlug?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  portalAccessEnabled?: boolean;
  portalStatusLabel?: string | null;
  portalNotes?: string | null;
}

export interface LeadEvent {
  id: string;
  officeId: string;
  leadId: string;
  type: 'created' | 'status_changed' | 'responsible_assigned' | 'whatsapp_opened' | 'note_added' | 'action_created' | 'action_completed' | 'document_uploaded' | 'calendar_event_created' | 'financial_record_created' | 'portal_updated';
  description: string;
  createdBy: string;
  createdAt: string;
  fromStatus?: LeadStatus | null;
  toStatus?: LeadStatus | null;
  metadata?: Record<string, unknown>;
}

export interface Task {
  id: string;
  officeId: string;
  leadId: string;
  title: string;
  dueAt: string;
  done: boolean;
  createdAt: string;
  completedAt?: string;
  responsibleUserId?: string | null;
  createdBy?: string | null;
}

export interface LeadDocument {
  id: string;
  officeId: string;
  leadId: string;
  name: string;
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  downloadUrl: string;
  category: DocumentCategory;
  visibleInPortal: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  officeId: string;
  leadId?: string | null;
  title: string;
  type: CalendarEventType;
  status: CalendarEventStatus;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
  notes?: string | null;
  responsibleUserId?: string | null;
  externalProvider?: 'google' | null;
  externalCalendarId?: string | null;
  externalEventId?: string | null;
  origin?: 'crm' | 'google' | 'linked';
  syncStatus?: 'not_connected' | 'pending' | 'processing' | 'synced' | 'failed' | 'cancelled' | 'conflict' | 'deleted_external';
  syncError?: string | null;
  lastSyncedAt?: string | null;
  googleEtag?: string | null;
  googleUpdatedAt?: string | null;
  lastLocalChangeAt?: string | null;
  lastRemoteChangeAt?: string | null;
  deletedAt?: string | null;
  attendees?: Array<{ email: string; displayName?: string | null; responseStatus?: string | null }>;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialRecord {
  id: string;
  officeId: string;
  leadId?: string | null;
  type: FinancialRecordType;
  status: FinancialRecordStatus;
  description: string;
  amount: number;
  dueAt?: string | null;
  paidAt?: string | null;
  paymentMethod?: PaymentMethod | null;
  notes?: string | null;
  proofDocumentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortalDocumentSummary {
  id: string;
  name: string;
  category: DocumentCategory;
  downloadUrl: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export interface PortalAppointmentSummary {
  id: string;
  title: string;
  type: CalendarEventType;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
}

export interface ClientPortalAccess {
  id: string;
  officeId: string;
  leadId: string;
  clientName: string;
  clientEmail?: string | null;
  statusLabel: string;
  publicNotes?: string | null;
  pendingItems: string[];
  documents: PortalDocumentSummary[];
  appointments: PortalAppointmentSummary[];
  isActive: boolean;
  expiresAt?: string | null;
  expiresAtMs?: number | null;
  createdAt: string;
  updatedAt: string;
}
