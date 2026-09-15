import React, { useEffect, useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { decideSupportAccess, listSupportAccessRequests, type SupportAccessRequest } from '../services/supabaseSupportAccess';
import { cancelOfficeDeletion, exportOfficeData, requestOfficeDeletion } from '../services/supabasePrivacy';

export const Privacy = () => {
  const { office, user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [supportRequests, setSupportRequests] = useState<SupportAccessRequest[]>([]);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const canManage = user?.role === 'owner';
  const refreshSupportRequests = async () => { if (canManage) setSupportRequests(await listSupportAccessRequests()); };
  useEffect(() => { refreshSupportRequests().catch(console.error); }, [canManage]);

  const handleExport = async () => {
    setLoading(true);
    try {
      const payload = await exportOfficeData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `exportacao-${payload.officeId}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Exportação gerada.', 'success');
    } catch (error) { console.error(error); showToast('Não foi possível gerar a exportação.', 'error'); }
    finally { setLoading(false); }
  };

  const handleDeletion = async () => {
    if (!canManage) return;
    setLoading(true);
    try { const result = await requestOfficeDeletion(); showToast(`Exclusão agendada para ${new Date(result.deletionScheduledAt).toLocaleDateString('pt-BR')}.`, 'success'); }
    catch (error) { console.error(error); showToast('Não foi possível agendar a exclusão.', 'error', { durationMs: null }); }
    finally { setLoading(false); setConfirmingDeletion(false); }
  };

  const handleCancelDeletion = async () => {
    try { await cancelOfficeDeletion(); showToast('Exclusão cancelada.', 'success'); window.location.reload(); }
    catch (error) { console.error(error); showToast('Não foi possível cancelar a exclusão.', 'error'); }
  };

  return <div className="mx-auto max-w-4xl space-y-6 pb-12"><PageHeader title="Privacidade e dados" description="Exporte seus dados e controle o ciclo de retenção do escritório." breadcrumbItems={[{ label: 'Privacidade' }]} /><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Controles LGPD</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-slate-600"><p>A exportação é gerada pelo backend com escopo do escritório autenticado e registrada em auditoria. A exclusão possui janela de segurança de 30 dias para permitir suporte e cancelamento operacional.</p><div className="flex flex-wrap gap-3"><Button onClick={handleExport} disabled={loading}>{loading ? 'Processando...' : <><Download className="mr-2 h-4 w-4" />Exportar meus dados</>}</Button><Button variant="danger" onClick={() => setConfirmingDeletion(true)} disabled={!canManage || Boolean(office?.deletionScheduledAt) || loading}><Trash2 className="mr-2 h-4 w-4" />Agendar exclusão</Button>{office?.deletionScheduledAt && <Button variant="outline" onClick={handleCancelDeletion}>Cancelar exclusão</Button>}</div>{office?.deletionScheduledAt && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">Exclusão agendada para {new Date(office.deletionScheduledAt).toLocaleString('pt-BR')}.</p>}{!canManage && <p className="text-xs text-slate-500">Somente o proprietário pode agendar ou cancelar a exclusão.</p>}</CardContent></Card>{canManage && <Card><CardHeader><CardTitle>Acesso temporário do suporte</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="text-slate-600">O suporte não entra no escritório sem autorização. Uma aprovação libera somente um diagnóstico resumido por 60 minutos e toda consulta é auditada.</p>{supportRequests.filter(item => item.status === 'pending').map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-4"><p className="font-semibold text-slate-900">Solicitação de suporte</p><p className="mt-1 text-slate-600">{item.reason}</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={async () => { await decideSupportAccess(item.id, 'approved'); showToast('Acesso aprovado por 60 minutos.', 'success'); await refreshSupportRequests(); }}>Aprovar</Button><Button size="sm" variant="outline" onClick={async () => { await decideSupportAccess(item.id, 'denied'); showToast('Acesso negado.', 'info'); await refreshSupportRequests(); }}>Negar</Button></div></div>)}{supportRequests.filter(item => item.status === 'approved' && Number(item.expiresAtMs || 0) > Date.now()).map(item => <div key={item.id} className="flex flex-col gap-3 rounded-lg bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between"><span>Acesso autorizado até {new Date(Number(item.expiresAtMs)).toLocaleTimeString('pt-BR')}</span><Button size="sm" variant="outline" onClick={async () => { await decideSupportAccess(item.id, 'revoked'); await refreshSupportRequests(); }}>Revogar agora</Button></div>)}{supportRequests.length === 0 && <p className="text-slate-500">Nenhuma solicitação de suporte.</p>}</CardContent></Card>}<ConfirmDialog open={confirmingDeletion} title="Agendar exclusão do escritório?" description="A exclusão será programada para daqui a 30 dias. Durante esse período, o proprietário ainda poderá cancelar a solicitação." confirmLabel="Agendar exclusão" variant="danger" loading={loading} onCancel={() => setConfirmingDeletion(false)} onConfirm={handleDeletion} /></div>;
};
