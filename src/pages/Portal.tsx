import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Copy, ExternalLink, FileText, KeyRound, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export const Portal = () => {
  const { leads, documents, calendarEvents, portalAccesses, upsertPortalAccess } = useData();
  const { showToast } = useToast();
  const [leadId, setLeadId] = useState(leads[0]?.id || '');
  const selectedLead = leads.find(lead => lead.id === leadId);
  const existingAccess = portalAccesses.find(access => access.leadId === leadId);
  const [statusLabel, setStatusLabel] = useState(existingAccess?.statusLabel || selectedLead?.portalStatusLabel || 'Atendimento em andamento');
  const [publicNotes, setPublicNotes] = useState(existingAccess?.publicNotes || selectedLead?.portalNotes || '');
  const [pendingItemsText, setPendingItemsText] = useState(existingAccess?.pendingItems.join('\n') || '');
  const [isActive, setIsActive] = useState(existingAccess?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const publicUrl = existingAccess ? `${window.location.origin}/portal/cliente/${existingAccess.id}` : '';
  const pendingItems = pendingItemsText.split('\n').map(item => item.trim()).filter(Boolean);

  const releasedDocuments = useMemo(() => {
    return documents
      .filter(document => document.leadId === leadId && document.visibleInPortal)
      .map(document => ({
        id: document.id,
        name: document.name,
        category: document.category,
        downloadUrl: document.downloadUrl,
        contentType: document.contentType,
        size: document.size,
        uploadedAt: document.createdAt,
      }));
  }, [documents, leadId]);

  const portalAppointments = useMemo(() => {
    return calendarEvents
      .filter(event => event.leadId === leadId && event.status === 'Agendado')
      .map(event => ({
        id: event.id,
        title: event.title,
        type: event.type,
        startAt: event.startAt,
        endAt: event.endAt || null,
        location: event.location || null,
      }));
  }, [calendarEvents, leadId]);

  const handleLeadChange = (value: string) => {
    const nextLead = leads.find(lead => lead.id === value);
    const nextAccess = portalAccesses.find(access => access.leadId === value);
    setLeadId(value);
    setStatusLabel(nextAccess?.statusLabel || nextLead?.portalStatusLabel || 'Atendimento em andamento');
    setPublicNotes(nextAccess?.publicNotes || nextLead?.portalNotes || '');
    setPendingItemsText(nextAccess?.pendingItems.join('\n') || '');
    setIsActive(nextAccess?.isActive ?? true);
  };

  useEffect(() => {
    if (!leadId && leads.length > 0) {
      handleLeadChange(leads[0].id);
    }
  }, [leadId, leads]);

  const handleSave = async () => {
    if (!selectedLead) return;

    setSaving(true);
    try {
      await upsertPortalAccess({
        id: existingAccess?.id,
        leadId: selectedLead.id,
        clientName: selectedLead.name,
        clientEmail: selectedLead.email || null,
        statusLabel: statusLabel.trim() || selectedLead.status,
        publicNotes: publicNotes.trim() || null,
        pendingItems,
        documents: releasedDocuments,
        appointments: portalAppointments,
        isActive,
        expiresAt: null,
      });
      showToast('Portal do cliente atualizado.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao atualizar portal do cliente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    showToast('Link do portal copiado.', 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <PageHeader
        title="Portal do Cliente"
        description="Controle exatamente o que cada cliente pode acompanhar fora do ambiente interno."
        breadcrumbItems={[{ label: 'Portal' }]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <Card className="border-slate-200 h-fit overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-500" />
              Controle de acesso
            </h2>
          </div>
          <CardContent className="p-5 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Cliente</label>
              <Select value={leadId} onChange={(event) => handleLeadChange(event.target.value)}>
                <option value="">Selecione um contato</option>
                {leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <FileText className="mb-2 h-4 w-4 text-brand-700" />
                <p className="text-2xl font-bold text-slate-950">{releasedDocuments.length}</p>
                <p className="text-xs font-semibold uppercase text-slate-500">Documentos</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <CalendarDays className="mb-2 h-4 w-4 text-emerald-700" />
                <p className="text-2xl font-bold text-slate-950">{portalAppointments.length}</p>
                <p className="text-xs font-semibold uppercase text-slate-500">Agenda</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Status público</label>
              <Input value={statusLabel} onChange={(event) => setStatusLabel(event.target.value)} placeholder="Ex: Documentos em análise" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Mensagem para o cliente</label>
              <textarea
                value={publicNotes}
                onChange={(event) => setPublicNotes(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[108px]"
                placeholder="Texto visível no portal. Não inclua estratégia jurídica interna."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Pendências</label>
              <textarea
                value={pendingItemsText}
                onChange={(event) => setPendingItemsText(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[96px]"
                placeholder="Uma pendência por linha"
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
              <span>Portal ativo</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
              />
            </label>

            <Button onClick={handleSave} disabled={!selectedLead || saving} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              {saving ? 'Atualizando...' : 'Atualizar portal'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 bg-white px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Link de acesso</p>
                <h2 className="text-base font-bold text-slate-950">Compartilhamento controlado</h2>
              </div>
              {publicUrl && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={handleCopyLink} className="gap-2">
                    <Copy className="w-4 h-4" />
                    Copiar link
                  </Button>
                  <Button asChild variant="outline" className="gap-2">
                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-4 h-4" />
                      Abrir portal
                    </a>
                  </Button>
                </div>
              )}
            </div>
            <CardContent className="p-5">
              {publicUrl ? (
                <Input readOnly value={publicUrl} className="font-mono text-xs bg-slate-50" />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <LockKeyhole className="mx-auto mb-3 h-7 w-7 text-slate-400" />
                  <p className="text-sm font-medium text-slate-600">Atualize o portal para gerar o link do cliente.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 bg-[#070B12] px-5 py-4 text-white">
              <p className="text-xs font-semibold uppercase text-brand-100">Prévia do cliente</p>
              <h2 className="mt-1 text-xl font-bold">{selectedLead?.name || 'Cliente selecionado'}</h2>
            </div>
            <CardContent className="p-0">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Status do atendimento</p>
                    <h3 className="mt-1 text-2xl font-bold text-slate-950">{statusLabel || 'Atendimento em andamento'}</h3>
                    {publicNotes && <p className="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{publicNotes}</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                <section className="p-5">
                  <h3 className="text-sm font-bold text-slate-950 mb-3">Pendências</h3>
                  {pendingItems.length > 0 ? (
                    <div className="space-y-2">
                      {pendingItems.map((item, index) => (
                        <div key={`${item}-${index}`} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma pendência aberta.</p>
                  )}
                </section>

                <section className="p-5">
                  <h3 className="text-sm font-bold text-slate-950 mb-3">Agenda</h3>
                  {portalAppointments.length > 0 ? (
                    <div className="space-y-2">
                      {portalAppointments.map(appointment => (
                        <div key={appointment.id} className="rounded-lg border border-slate-200 p-3">
                          <p className="text-sm font-semibold text-slate-900">{appointment.title}</p>
                          <p className="text-xs text-slate-500">{new Date(appointment.startAt).toLocaleString('pt-BR')}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhum compromisso liberado.</p>
                  )}
                </section>

                <section className="p-5">
                  <h3 className="text-sm font-bold text-slate-950 mb-3">Documentos</h3>
                  {releasedDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {releasedDocuments.map(document => (
                        <div key={document.id} className="rounded-lg border border-slate-200 p-3">
                          <p className="text-sm font-semibold text-slate-900 truncate">{document.name}</p>
                          <p className="text-xs text-slate-500">{document.category}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhum documento liberado.</p>
                  )}
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
