import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { TextPromptDialog } from '../components/ui/TextPromptDialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscriptionLabel } from '../lib/access';
import { getPlatformMetrics, listOperationsInbox, listPlatformOffices, setPlatformOfficeStatus, updateOperationsInboxItem, type OperationsInboxItem, type PlatformMetrics } from '../services/supabaseAdmin';
import { getSupportOfficeSnapshot, listSupportAccessRequests, requestSupportAccess, type SupportAccessRequest } from '../services/supabaseSupportAccess';
import type { Office, SubscriptionStatus } from '../types';

const subscriptionOptions: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELED'];

export const Admin = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [offices, setOffices] = useState<Office[]>([]);
  const [accessRequests, setAccessRequests] = useState<SupportAccessRequest[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<OperationsInboxItem[]>([]);
  const [supportTickets, setSupportTickets] = useState<OperationsInboxItem[]>([]);
  const [integrationErrors, setIntegrationErrors] = useState<OperationsInboxItem[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatingOfficeId, setUpdatingOfficeId] = useState<string | null>(null);
  const [accessOffice, setAccessOffice] = useState<Office | null>(null);
  const [accessReason, setAccessReason] = useState('');
  const [requestingAccess, setRequestingAccess] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError('');
    try {
      const [officeResult, requests, inbox, metricResult] = await Promise.all([listPlatformOffices(), listSupportAccessRequests(), listOperationsInbox(), getPlatformMetrics()]);
      setOffices(officeResult.offices); setAccessRequests(requests); setPrivacyRequests(inbox.privacyRequests);
      setSupportTickets(inbox.supportTickets); setIntegrationErrors(inbox.integrationErrors); setMetrics(metricResult);
    } catch (error) {
      console.error(error); setLoadError('Não foi possível carregar a administração global. Tente novamente.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user?.globalRole === 'platform_admin') void refresh(); }, [refresh, user?.globalRole]);
  if (user?.globalRole !== 'platform_admin') return <Navigate to="/" replace />;

  const updateStatus = async (officeId: string, status: SubscriptionStatus) => {
    setUpdatingOfficeId(officeId);
    try {
      await setPlatformOfficeStatus(officeId, status);
      setOffices(items => items.map(item => item.id === officeId ? { ...item, subscriptionStatus: status } : item));
      showToast('Status do escritório atualizado.', 'success');
    } catch (error) { console.error(error); showToast('Não foi possível atualizar o status do escritório.', 'error', { durationMs: null }); }
    finally { setUpdatingOfficeId(null); }
  };

  const submitAccessRequest = async () => {
    if (!accessOffice || accessReason.trim().length < 10) return;
    setRequestingAccess(true);
    try {
      await requestSupportAccess(accessOffice.id, accessReason.trim());
      showToast('Solicitação enviada ao proprietário do escritório.', 'success');
      setAccessOffice(null); setAccessReason(''); await refresh();
    } catch (error) { console.error(error); showToast('Não foi possível solicitar o acesso técnico.', 'error', { durationMs: null }); }
    finally { setRequestingAccess(false); }
  };

  const loadSnapshot = async (requestId: string) => {
    try { setSnapshot(await getSupportOfficeSnapshot(requestId) as unknown as Record<string, unknown>); showToast('Diagnóstico autorizado carregado.', 'success'); }
    catch (error) { console.error(error); showToast('Não foi possível carregar o diagnóstico.', 'error', { durationMs: null }); }
  };

  const inboxCard = (title: string, kind: 'privacy' | 'support', items: OperationsInboxItem[]) => <Card><CardHeader><CardTitle>{title} ({items.filter(item => !['resolved', 'closed'].includes(item.status)).length})</CardTitle></CardHeader><CardContent className="space-y-3">{items.slice(0, 20).map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-4 text-sm"><div className="flex flex-col justify-between gap-3 lg:flex-row"><div className="min-w-0"><p className="font-semibold text-slate-900">{item.subject || item.requestType || item.id}</p><p className="mt-1 break-words text-slate-600">{item.message || item.details}</p><p className="mt-2 text-xs text-slate-500">{item.email || 'Usuário autenticado'} · {item.status}</p></div><select className="h-9 rounded-md border border-slate-300 px-2" value={item.status} onChange={async event => { try { await updateOperationsInboxItem(kind, item.id, event.target.value); showToast('Item operacional atualizado.', 'success'); await refresh(); } catch (error) { console.error(error); showToast('Não foi possível atualizar o item.', 'error', { durationMs: null }); } }}>{['open', 'in_progress', 'resolved', 'closed'].map(status => <option key={status} value={status}>{status}</option>)}</select></div></div>)}</CardContent></Card>;

  return <div className="mx-auto max-w-6xl space-y-6 pb-12">
    <PageHeader title="Administração global" description="Visão operacional protegida para suporte e gestão da base SaaS." breadcrumbItems={[{ label: 'Administração global' }]} />
    {loadError && <div role="alert" className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"><span>{loadError}</span><button className="font-semibold underline" onClick={() => void refresh()}>Tentar novamente</button></div>}
    {loading && <p role="status" className="text-sm text-slate-500">Carregando dados administrativos...</p>}
    {metrics && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Escritórios', metrics.totalOffices], ['Ativação', `${metrics.activationRate}%`], ['Conversão', `${metrics.conversionRate}%`], ['MRR estimado', metrics.mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]].map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></CardContent></Card>)}</div>}
    <Card><CardHeader><CardTitle>Escritórios ({offices.length})</CardTitle></CardHeader><CardContent className="space-y-3">{offices.map(office => {
      const approved = accessRequests.find(item => item.officeId === office.id && item.status === 'approved' && Number(item.expiresAtMs || 0) > Date.now());
      return <div key={office.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_160px_170px_170px] lg:items-center"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{office.name}</p><p className="break-words text-xs text-slate-500">{office.email} · {office.planCode || 'trial'}</p></div><span className="text-sm text-slate-600">{office.subscriptionStatus ? subscriptionLabel[office.subscriptionStatus] : 'Sem status'}</span><select className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" disabled={updatingOfficeId === office.id} value={office.subscriptionStatus || 'TRIALING'} onChange={event => void updateStatus(office.id, event.target.value as SubscriptionStatus)}>{subscriptionOptions.map(status => <option key={status} value={status}>{subscriptionLabel[status]}</option>)}</select>{approved ? <button className="text-left text-sm font-semibold text-brand-700 lg:text-center" onClick={() => void loadSnapshot(approved.id)}>Diagnóstico autorizado</button> : <button className="text-left text-sm font-semibold text-slate-600 lg:text-center" onClick={() => { setAccessOffice(office); setAccessReason(''); }}>Solicitar acesso</button>}</div>;
    })}{!loading && offices.length === 0 && <p className="text-sm text-slate-500">Nenhum escritório retornado ou Functions ainda não publicadas.</p>}</CardContent></Card>
    {inboxCard('Solicitações LGPD', 'privacy', privacyRequests)}
    {inboxCard('Chamados de suporte', 'support', supportTickets)}
    {integrationErrors.length > 0 && <Card><CardHeader><CardTitle>Erros de integração ({integrationErrors.length})</CardTitle></CardHeader><CardContent><pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-red-200">{JSON.stringify(integrationErrors, null, 2)}</pre></CardContent></Card>}
    {snapshot && <Card><CardHeader><CardTitle>Diagnóstico autorizado</CardTitle></CardHeader><CardContent><pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(snapshot, null, 2)}</pre></CardContent></Card>}
    <TextPromptDialog open={Boolean(accessOffice)} title="Solicitar acesso técnico" description={`Explique por que o diagnóstico temporário de ${accessOffice?.name || 'este escritório'} é necessário. O proprietário deverá autorizar o acesso.`} label="Motivo técnico" value={accessReason} minimumLength={10} confirmLabel="Enviar solicitação" loading={requestingAccess} onValueChange={setAccessReason} onCancel={() => { setAccessOffice(null); setAccessReason(''); }} onConfirm={submitAccessRequest} />
  </div>;
};
