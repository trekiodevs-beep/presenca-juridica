import React, { useMemo, useState } from 'react';
import { Check, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOperationalAlarms } from '../hooks/useOperationalAlarms';
import { listOperationalAlarmEvents } from '../services/supabaseAlarms';
import type { OperationalAlarmEvent } from '../types';
import { useToast } from '../context/ToastContext';

export function Alarms() {
  const { active, loading, error, refresh, markRead, acknowledge, resolve, snooze } = useOperationalAlarms();
  const { showToast } = useToast();
  const [severity, setSeverity] = useState<'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'>('ALL');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Record<string, OperationalAlarmEvent[]>>({});
  const [actionKey, setActionKey] = useState<string | null>(null);
  const filtered = useMemo(() => active.filter(({ alarm }) => (severity === 'ALL' || alarm.severity === severity) && `${alarm.title} ${alarm.message} ${alarm.ruleCode}`.toLowerCase().includes(query.toLowerCase())), [active, query, severity]);
  const runAlarmAction = async (key: string, action: () => Promise<void>, successMessage: string) => {
    if (actionKey) return;
    setActionKey(key);
    try { await action(); showToast(successMessage, 'success'); }
    catch (cause) { console.error(cause); showToast('Não foi possível atualizar este alerta. Tente novamente.', 'error', { durationMs: null }); }
    finally { setActionKey(null); }
  };
  return <div className="mx-auto max-w-5xl space-y-5"><div><h1 className="text-2xl font-bold text-slate-900">Central de atenção</h1><p className="mt-1 text-sm text-slate-500">Pendências operacionais do escritório, com histórico e responsável.</p></div>
    <div className="flex flex-col gap-2 sm:flex-row"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar alerta…" className="h-9 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" /><select value={severity} onChange={event => setSeverity(event.target.value as typeof severity)} className="h-9 rounded-md border border-slate-200 px-3 text-sm"><option value="ALL">Todas as severidades</option><option value="CRITICAL">Críticas</option><option value="WARNING">Avisos</option><option value="INFO">Informativas</option></select></div>
    {error && <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><span>Não foi possível atualizar a Central agora.</span><button onClick={() => void refresh()} className="font-semibold underline">Tentar novamente</button></div>}
    {loading ? <div className="text-sm text-slate-500">Carregando alertas…</div> : !filtered.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{active.length ? 'Nenhum alerta corresponde aos filtros.' : 'Tudo em dia por aqui.'}</div> : <div className="space-y-3">{filtered.map(({ alarm }) => <article key={alarm.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${alarm.severity === 'CRITICAL' ? 'bg-red-600' : alarm.severity === 'WARNING' ? 'bg-amber-500' : 'bg-blue-500'}`} /><div><h2 className="font-semibold text-slate-900">{alarm.title}</h2><p className="mt-1 text-sm text-slate-600">{alarm.message}</p><p className="mt-2 text-xs text-slate-400">Regra {alarm.ruleCode} · {alarm.state === 'ACKNOWLEDGED' ? 'Em atendimento' : 'Aberto'}</p></div></div><div className="flex flex-wrap gap-2"><button disabled={Boolean(actionKey)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs disabled:opacity-50" onClick={() => void runAlarmAction(`${alarm.id}:read`, () => markRead(alarm.id), 'Alerta marcado como lido.')}>Marcar lido</button><button disabled={Boolean(actionKey)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs disabled:opacity-50" onClick={() => void runAlarmAction(`${alarm.id}:snooze`, () => snooze(alarm.id), 'Alerta adiado por uma hora.')}><Clock3 className="mr-1 inline h-3 w-3" />1 h</button>{alarm.state === 'OPEN' && <button disabled={Boolean(actionKey)} className="rounded-md bg-brand-700 px-2.5 py-1.5 text-xs text-white disabled:opacity-50" onClick={() => void runAlarmAction(`${alarm.id}:ack`, () => acknowledge(alarm.id, alarm.version), 'Alerta assumido para atendimento.')}>Assumir</button>}<button disabled={Boolean(actionKey)} className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white disabled:opacity-50" onClick={() => void runAlarmAction(`${alarm.id}:resolve`, () => resolve(alarm.id, alarm.version), 'Alerta resolvido.')}><Check className="mr-1 inline h-3 w-3" />Resolver</button><button className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs" onClick={() => void (history[alarm.id] ? setHistory(current => { const next = { ...current }; delete next[alarm.id]; return next; }) : listOperationalAlarmEvents(alarm.id).then(events => setHistory(current => ({ ...current, [alarm.id]: events }))))}>Histórico</button>{alarm.actionPath && <Link to={alarm.actionPath} className="rounded-md px-2.5 py-1.5 text-xs text-brand-700">Abrir origem</Link>}</div></div>{history[alarm.id] && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{history[alarm.id].map(event => <div key={event.id} className="flex justify-between gap-3 text-xs text-slate-500"><span>{event.eventType}{event.reason ? ` · ${event.reason}` : ''}</span><time>{new Date(event.createdAt).toLocaleString('pt-BR')}</time></div>)}</div>}</article>)}</div>}
  </div>;
}
