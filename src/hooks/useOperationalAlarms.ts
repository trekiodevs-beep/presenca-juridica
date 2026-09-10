import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { alarmAction, listOperationalAlarms, type AlarmWithRecipient } from '../services/supabaseAlarms';
import { supabase } from '../lib/supabase';
import { mockOperationalAlarms } from '../lib/mockAlarms';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export function useOperationalAlarms() {
  const { office, user } = useAuth();
  const [items, setItems] = useState<AlarmWithRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(30000);
  const channelInstance = useRef(Math.random().toString(36).slice(2));
  const refresh = useCallback(async () => {
    if (USE_MOCK) { setItems(mockOperationalAlarms); setLoading(false); return; }
    if (!office?.id) { setItems([]); setLoading(false); return; }
    try { setItems(await listOperationalAlarms(office.id)); setError(null); setPollMs(30000); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os alertas.'); setPollMs(current => Math.min(current * 2, 300000)); }
    finally { setLoading(false); }
  }, [office?.id]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), pollMs); return () => window.clearInterval(timer); }, [pollMs, refresh]);
  useEffect(() => {
    if (!office?.id || USE_MOCK) return;
    const channel = supabase.channel(`operational-alarms:${office.id}:${user?.id || 'anonymous'}:${channelInstance.current}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'operational_alarms', filter: `office_id=eq.${office.id}` }, () => void refresh());
    if (user?.id) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'operational_alarm_recipients', filter: `user_id=eq.${user.id}` }, () => void refresh());
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [office?.id, refresh, user?.id]);
  const active = useMemo(() => items.filter(({ alarm, recipient }) => !recipient.dismissedAt && (!recipient.snoozedUntil || new Date(recipient.snoozedUntil).getTime() <= Date.now())), [items]);
  const unread = useMemo(() => active.filter(({ recipient }) => !recipient.readAt).length, [active]);
  const critical = useMemo(() => active.filter(({ alarm }) => alarm.severity === 'CRITICAL').length, [active]);
  const run = useCallback(async (action: Parameters<typeof alarmAction>[0], args: Record<string, unknown>) => { await alarmAction(action, args); await refresh(); }, [refresh]);
  return { items, active, unread, critical, loading, error, user, refresh, markRead: (id: string) => run('mark_operational_alarm_read', { target_alarm_id: id }), acknowledge: (id: string, version: number) => run('acknowledge_operational_alarm', { target_alarm_id: id, expected_version: version }), resolve: (id: string, version: number) => run('resolve_operational_alarm', { target_alarm_id: id, expected_version: version }), snooze: (id: string) => run('snooze_operational_alarm_for_me', { target_alarm_id: id, until_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }) };
}
