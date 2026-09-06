import type { Office, SubscriptionStatus, User } from '../types';
import { hasPermission } from './plans';

const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessMode = 'full' | 'grace' | 'read_only' | 'blocked';

export const getAccessMode = (office?: Office | null, now = Date.now()): AccessMode => {
  if (!office) return 'blocked';
  const status = office.subscriptionStatus;
  if (status === 'ACTIVE' || status === 'TRIALING') {
    if (status === 'TRIALING') {
      const expiresAt = office.trialEndsAtMs || (office.trialEndsAt ? new Date(office.trialEndsAt).getTime() : 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= now) return 'read_only';
    }
    return 'full';
  }
  if (status === 'GRACE_PERIOD' || status === 'PAST_DUE') {
    if (!office.graceEndsAtMs || now >= office.graceEndsAtMs) return 'read_only';
    return 'grace';
  }
  if (status === 'SUSPENDED' || status === 'CANCELED' || status === 'EXPIRED') return 'read_only';
  return 'blocked';
};

export const isReadOnlyAccess = (office?: Office | null) => {
  const mode = getAccessMode(office);
  return mode === 'read_only' || mode === 'blocked';
};

export const canWriteOffice = (office?: Office | null) => {
  const mode = getAccessMode(office);
  return mode === 'full' || mode === 'grace';
};

export const can = (user: User | null | undefined, permission: Parameters<typeof hasPermission>[1], office?: Office | null) =>
  Boolean(user && canWriteOffice(office) && hasPermission(user.role, permission));

export const getGraceDaysRemaining = (office?: Office | null, now = Date.now()) => {
  if (!office?.graceEndsAtMs) return null;
  return Math.max(0, Math.ceil((office.graceEndsAtMs - now) / DAY_MS));
};

export const subscriptionLabel: Record<SubscriptionStatus, string> = {
  TRIALING: 'Em teste',
  ACTIVE: 'Ativo',
  PAST_DUE: 'Pagamento pendente',
  GRACE_PERIOD: 'Período de tolerância',
  SUSPENDED: 'Acesso somente leitura',
  CANCELED: 'Cancelado',
  EXPIRED: 'Teste expirado',
};
