import { supabase } from '../lib/supabase';
import type { AlarmSeverity, OperationalAlarm, OperationalAlarmEvent, OperationalAlarmRecipient } from '../types';

const mapAlarm = (row: Record<string, unknown>): OperationalAlarm => ({
  id: String(row.id), officeId: String(row.office_id), sourceType: row.source_type as OperationalAlarm['sourceType'],
  sourceId: row.source_id as string | null, ruleCode: String(row.rule_code), cycleKey: String(row.cycle_key),
  severity: row.severity as AlarmSeverity, state: row.state as OperationalAlarm['state'], assignedUserId: row.assigned_user_id as string | null,
  title: String(row.title), message: String(row.message), actionPath: row.action_path as string | null, baseAt: row.base_at as string | null,
  dueAt: row.due_at as string | null, triggeredAt: String(row.triggered_at), acknowledgedAt: row.acknowledged_at as string | null,
  acknowledgedBy: row.acknowledged_by as string | null, resolvedAt: row.resolved_at as string | null, resolvedBy: row.resolved_by as string | null,
  resolutionCode: row.resolution_code as string | null, resolvedAutomatically: Boolean(row.resolved_automatically),
  metadata: (row.metadata as Record<string, unknown>) || {}, ruleVersion: Number(row.rule_version), version: Number(row.version),
  lastEvaluatedAt: row.last_evaluated_at as string | null, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const mapRecipient = (row: Record<string, unknown>): OperationalAlarmRecipient => ({
  alarmId: String(row.alarm_id), officeId: String(row.office_id), userId: String(row.user_id),
  deliveryReason: row.delivery_reason as OperationalAlarmRecipient['deliveryReason'], readAt: row.read_at as string | null,
  snoozedUntil: row.snoozed_until as string | null, dismissedAt: row.dismissed_at as string | null,
  createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

export interface AlarmWithRecipient { alarm: OperationalAlarm; recipient: OperationalAlarmRecipient; }

export async function listOperationalAlarms(officeId: string, limit = 50): Promise<AlarmWithRecipient[]> {
  const { data: alarms, error } = await supabase.from('operational_alarms').select('*').eq('office_id', officeId)
    .in('state', ['OPEN', 'ACKNOWLEDGED']).order('triggered_at', { ascending: false }).limit(limit);
  if (error) throw error;
  const ids = (alarms || []).map(row => String(row.id));
  if (!ids.length) return [];
  const { data: recipients, error: recipientError } = await supabase.from('operational_alarm_recipients').select('*').in('alarm_id', ids);
  if (recipientError) throw recipientError;
  const recipientMap = new Map((recipients || []).map(row => [String(row.alarm_id), mapRecipient(row as Record<string, unknown>)]));
  return (alarms || []).map(row => ({ alarm: mapAlarm(row as Record<string, unknown>), recipient: recipientMap.get(String(row.id)) })).filter((item): item is AlarmWithRecipient => Boolean(item.recipient));
}

export async function alarmAction(action: 'mark_operational_alarm_read' | 'acknowledge_operational_alarm' | 'resolve_operational_alarm' | 'snooze_operational_alarm_for_me' | 'dismiss_operational_alarm_for_me', args: Record<string, unknown>) {
  const { error } = await supabase.rpc(action, args);
  if (error) throw error;
}

export async function listOperationalAlarmEvents(alarmId: string): Promise<OperationalAlarmEvent[]> {
  const { data, error } = await supabase.from('operational_alarm_events').select('*').eq('alarm_id', alarmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({ id: String(row.id), alarmId: String(row.alarm_id), officeId: String(row.office_id), eventType: row.event_type as OperationalAlarmEvent['eventType'], fromState: row.from_state as OperationalAlarmEvent['fromState'], toState: row.to_state as OperationalAlarmEvent['toState'], actorUserId: row.actor_user_id as string | null, reason: row.reason as string | null, metadata: (row.metadata as Record<string, unknown>) || {}, createdAt: String(row.created_at) }));
}
