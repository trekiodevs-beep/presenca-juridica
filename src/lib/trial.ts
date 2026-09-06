import type { Office } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const TRIAL_DAYS = 15;

export type TrialState =
  | {
      kind: 'trialing';
      daysRemaining: number;
      trialEndsAt: string;
      label: string;
    }
  | {
      kind: 'expired';
      daysOverdue: number;
      trialEndsAt: string;
      label: string;
    }
  | {
      kind: 'active';
      label: string;
    }
  | {
      kind: 'not_configured';
      label: string;
    };

export const createTrialWindow = (now = new Date()) => {
  const trialStartedAt = now.toISOString();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS).toISOString();

  return {
    subscriptionStatus: 'TRIALING' as const,
    planCode: 'trial' as const,
    trialStartedAt,
    trialEndsAt,
    trialEndsAtMs: now.getTime() + TRIAL_DAYS * DAY_MS,
    subscriptionUpdatedAt: trialStartedAt,
  };
};

export const getTrialState = (office?: Office | null, now = new Date()): TrialState | null => {
  if (!office) return null;

  if (office.subscriptionStatus === 'ACTIVE') {
    return { kind: 'active', label: 'Plano ativo' };
  }

  if (office.subscriptionStatus === 'PAST_DUE' || office.subscriptionStatus === 'GRACE_PERIOD') {
    return { kind: 'active', label: 'Pagamento pendente — acesso preservado durante a tolerância' };
  }

  if (office.subscriptionStatus === 'SUSPENDED' || office.subscriptionStatus === 'CANCELED') {
    return { kind: 'expired', daysOverdue: 0, trialEndsAt: office.trialEndsAt || new Date().toISOString(), label: 'Acesso somente leitura' };
  }

  if (!office.trialEndsAt) {
    return { kind: 'not_configured', label: 'Teste comercial não configurado' };
  }

  const trialEndsAt = new Date(office.trialEndsAt);

  if (Number.isNaN(trialEndsAt.getTime())) {
    return { kind: 'not_configured', label: 'Teste comercial com data inválida' };
  }

  const diffMs = trialEndsAt.getTime() - now.getTime();

  if (office.subscriptionStatus === 'EXPIRED' || diffMs <= 0) {
    const daysOverdue = Math.max(1, Math.ceil(Math.abs(diffMs) / DAY_MS));
    return {
      kind: 'expired',
      daysOverdue,
      trialEndsAt: office.trialEndsAt,
      label: 'Teste expirado',
    };
  }

  const daysRemaining = Math.max(1, Math.ceil(diffMs / DAY_MS));

  return {
    kind: 'trialing',
    daysRemaining,
    trialEndsAt: office.trialEndsAt,
    label: `${daysRemaining} ${daysRemaining === 1 ? 'dia restante' : 'dias restantes'} de teste`,
  };
};
