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
  | 'CANCELED'
  | 'EXPIRED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'lawyer' | 'assistant';
  officeId: string;
  createdAt: string;
}

export interface Office {
  id: string;
  name: string;
  lawyerName: string;
  oab: string;
  city: string;
  state: string;
  whatsapp: string;
  email: string;
  areas: LegalArea[];
  slug?: string;
  subscriptionStatus?: SubscriptionStatus;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  subscriptionUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}
