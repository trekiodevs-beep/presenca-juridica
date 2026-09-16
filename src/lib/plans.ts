import type { Permission, Plan, PlanCode, PlanLimits, UserRole } from '../types';

export const TRIAL_PLAN: Plan = {
  code: 'trial',
  name: 'Teste',
  audience: 'Avaliação sem cartão',
  priceCents: 0,
  interval: null,
  limits: { maxUsers: 2, maxContacts: 100, maxStorageBytes: 512 * 1024 * 1024 },
  features: ['Uso completo por 15 dias', 'Onboarding guiado', 'Link público do escritório'],
};

export const CORE_PLAN: Plan = {
  code: 'core',
  name: 'Presença Jurídica',
  audience: 'CRM completo para o escritório',
  priceCents: 11990,
  interval: 'month',
  limits: { maxUsers: 3, maxContacts: 500, maxStorageBytes: 5 * 1024 * 1024 * 1024 },
  features: ['Até 3 usuários', 'Até 500 contatos', '5 GB de documentos', 'Agenda e portal do cliente'],
};

export const COMMERCIAL_PLANS: Record<Exclude<PlanCode, 'trial' | 'core'>, Plan> = {
  essential: {
    code: 'essential',
    name: 'Essencial',
    audience: 'Escritório pequeno',
    priceCents: 14900,
    interval: 'month',
    limits: { maxUsers: 3, maxContacts: 500, maxStorageBytes: 5 * 1024 * 1024 * 1024 },
    features: ['Até 3 usuários', 'Até 500 contatos', '5 GB de documentos'],
  },
  professional: {
    code: 'professional',
    name: 'Profissional',
    audience: 'Escritório estruturado',
    priceCents: 24900,
    interval: 'month',
    limits: { maxUsers: 10, maxContacts: 2000, maxStorageBytes: 20 * 1024 * 1024 * 1024 },
    features: ['Até 10 usuários', 'Até 2.000 contatos', '20 GB de documentos'],
  },
  custom: {
    code: 'custom',
    name: 'Personalizado',
    audience: 'Operação maior',
    priceCents: null,
    interval: null,
    limits: { maxUsers: 1000, maxContacts: 1000000, maxStorageBytes: 1024 * 1024 * 1024 * 1024 },
    features: ['Limites negociados', 'Implantação orientada', 'Contrato sob consulta'],
  },
};

export const PLANS: Record<PlanCode, Plan> = { trial: TRIAL_PLAN, core: CORE_PLAN, ...COMMERCIAL_PLANS };

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: ['office.manage', 'billing.manage', 'members.manage', 'contacts.read', 'contacts.write', 'tasks.write', 'calendar.write', 'finance.read', 'finance.write', 'documents.write', 'portal.write', 'export.read'],
  admin: ['office.manage', 'members.manage', 'contacts.read', 'contacts.write', 'tasks.write', 'calendar.write', 'finance.read', 'finance.write', 'documents.write', 'portal.write', 'export.read'],
  lawyer: ['contacts.read', 'contacts.write', 'tasks.write', 'calendar.write', 'finance.read', 'finance.write', 'documents.write', 'portal.write', 'export.read'],
  assistant: ['contacts.read', 'contacts.write', 'tasks.write', 'calendar.write', 'documents.write', 'portal.write', 'export.read'],
  finance: ['contacts.read', 'finance.read', 'finance.write', 'export.read'],
  read: ['contacts.read', 'finance.read', 'export.read'],
};

export const hasPermission = (role: UserRole | undefined, permission: Permission) =>
  Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));

export const getPlan = (code?: PlanCode | null): Plan => PLANS[code || 'trial'];

export const getPlanLimits = (code?: PlanCode | null): PlanLimits => getPlan(code).limits;
