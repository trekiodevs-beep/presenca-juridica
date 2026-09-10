import type { AlarmWithRecipient } from '../services/supabaseAlarms';

const now = new Date().toISOString();
export const mockOperationalAlarms: AlarmWithRecipient[] = [
  {
    alarm: { id: 'demo-alarm-1', officeId: 'o1', sourceType: 'LEAD', sourceId: 'l2', ruleCode: 'TRIAGE_OVERDUE', cycleKey: 'demo', severity: 'WARNING', state: 'OPEN', assignedUserId: null, title: 'Triagem pendente', message: 'Carlos Mendes está aguardando triagem há mais de 24 horas.', actionPath: '/leads/l2', baseAt: now, dueAt: now, triggeredAt: now, acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, resolvedBy: null, resolutionCode: null, resolvedAutomatically: false, metadata: {}, ruleVersion: 1, version: 1, lastEvaluatedAt: now, createdAt: now, updatedAt: now },
    recipient: { alarmId: 'demo-alarm-1', officeId: 'o1', userId: 'u1', deliveryReason: 'OWNER', readAt: null, snoozedUntil: null, dismissedAt: null, createdAt: now, updatedAt: now },
  },
];
