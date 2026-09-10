import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, Check, CheckCircle2, Clock3, Download, FileText, LockKeyhole, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { getClientPortalAccessByToken } from '../services/supabaseDb';
import { ClientPortalAccess } from '../types';
import { Button } from '../components/ui/Button';
import { mockPortalAccesses } from '../mockData';
import { getDocumentDownloadUrl } from '../services/supabaseDb';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

const isPortalAccessActive = (portalAccess: ClientPortalAccess | null) => {
  if (!portalAccess?.isActive) return false;
  if (!portalAccess.expiresAt) return true;

  const expiresAt = new Date(portalAccess.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

const formatBytes = (size: number) => {
  if (!size) return '0 KB';
  const kilobytes = size / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(0)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
};

const formatDocumentName = (name: string) => {
  try {
    return decodeURIComponent(name).replace(/[_]+/g, ' ');
  } catch {
    return name.replace(/%20/g, ' ').replace(/[_]+/g, ' ');
  }
};

const formatAppointmentDate = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Data a confirmar';
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

export const PublicClientPortal = () => {
  const { token } = useParams();
  const [access, setAccess] = useState<ClientPortalAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPortal = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const portalAccess = USE_MOCK
          ? mockPortalAccesses.find(item => item.id === token) || null
          : await getClientPortalAccessByToken(token);

        if (mounted) setAccess(isPortalAccessActive(portalAccess) ? portalAccess : null);
      } catch (error) {
        console.error(error);
        if (mounted) setAccess(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPortal();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleDownload = async (documentId: string, fallbackUrl: string) => {
    if (!token) return;
    setDownloadingDocumentId(documentId);
    try {
      const result = USE_MOCK ? { downloadUrl: fallbackUrl } : await getDocumentDownloadUrl(documentId, token);
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      window.alert('Não foi possível autorizar este documento.');
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  if (!access) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
            <LockKeyhole className="w-6 h-6 text-slate-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Portal indisponível</h1>
          <p className="mt-2 text-sm text-slate-600">O link não existe, expirou ou foi desativado pelo escritório.</p>
        </div>
      </div>
    );
  }

  const firstName = access.clientName.trim().split(/\s+/)[0] || 'cliente';
  const orderedAppointments = [...access.appointments].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const nextAppointment = orderedAppointments.find(appointment => new Date(appointment.startAt).getTime() >= Date.now()) || orderedAppointments[0];
  const lastUpdated = new Date(access.updatedAt);
  const lastUpdatedLabel = Number.isFinite(lastUpdated.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(lastUpdated)
    : null;

  return (
    <div className="min-h-screen bg-[#f7f5f0]">
      <header className="border-b border-[#f2c778]/20 bg-[linear-gradient(90deg,#05070c_0%,#0a1222_55%,#070b12_100%)] text-white">
        <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 p-1 ring-1 ring-inset ring-[#f2c778]/35 shadow-[0_0_20px_rgba(0,91,255,.14)]">
              <img src="/branding/presenca-juridica-archetype-v2.png" alt="Símbolo do Presença Jurídica" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.08em] text-white">PRESENÇA JURÍDICA</p>
              <p className="mt-0.5 text-[9px] font-semibold tracking-[0.18em] text-[#f2c778]">PORTAL DE ACOMPANHAMENTO</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300 sm:text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Ambiente protegido</span>
            <span className="sm:hidden">Protegido</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10 space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#070b12] text-white shadow-[0_24px_70px_rgba(7,11,18,.16)]">
          <div aria-hidden="true" className="absolute inset-0 opacity-90" style={{ backgroundImage: 'radial-gradient(circle at 8% 10%, rgba(0,91,255,.20), transparent 32%), radial-gradient(circle at 88% 82%, rgba(242,199,120,.09), transparent 25%)' }} />
          <img aria-hidden="true" src="/branding/presenca-juridica-archetype-v2.png" alt="" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 object-contain opacity-[0.07] sm:h-96 sm:w-96" />
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_320px] lg:items-end">
            <div className="relative z-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#f2c778]/25 bg-[#f2c778]/[0.07] px-3 py-1.5 text-xs font-semibold text-[#f5d89f]">
                <Sparkles className="h-3.5 w-3.5" /> Olá, {firstName}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f2c778]">Situação atual</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{access.statusLabel}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                {access.publicNotes || 'Aqui você encontra as informações que foram liberadas para acompanhar seu atendimento.'}
              </p>
              {lastUpdatedLabel && <p className="mt-5 text-xs text-slate-400">Atualizado em {lastUpdatedLabel}</p>}
            </div>
            <div className="relative z-10 rounded-xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#f5d89f]">Visão rápida</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-2xl font-bold">{access.pendingItems.length}</p><p className="mt-1 text-[11px] text-slate-400">pendências</p></div>
                <div className="border-x border-white/10"><p className="text-2xl font-bold">{access.appointments.length}</p><p className="mt-1 text-[11px] text-slate-400">agenda</p></div>
                <div><p className="text-2xl font-bold">{access.documents.length}</p><p className="mt-1 text-[11px] text-slate-400">documentos</p></div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-[#e7e0d3] bg-white p-5 shadow-[0_10px_30px_rgba(28,35,48,.06)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Próximo passo</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Sua atenção</h2>
              </div>
              <div className={`rounded-full p-2.5 ${access.pendingItems.length ? 'bg-amber-100 text-amber-800' : 'bg-brand-50 text-brand-700'}`}>
                {access.pendingItems.length ? <Clock3 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>
            </div>
            {access.pendingItems.length > 0 ? (
              <ul className="space-y-3">
                {access.pendingItems.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-950">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-900"><Check className="h-4 w-4" /> Tudo certo por enquanto</p>
                <p className="mt-1.5 text-sm leading-6 text-brand-800">Não há nenhuma ação solicitada a você neste momento.</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#e7e0d3] bg-white p-5 shadow-[0_10px_30px_rgba(28,35,48,.06)] sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-brand-50 p-2.5 text-brand-700"><CalendarDays className="h-5 w-5" /></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agenda</p><h2 className="text-xl font-bold text-slate-950">Próximo compromisso</h2></div>
            </div>
            {nextAppointment ? (
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                <p className="font-bold text-slate-950">{nextAppointment.title}</p>
                <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-700"><Clock3 className="mt-1 h-4 w-4 shrink-0 text-brand-700" /> <span className="first-letter:uppercase">{formatAppointmentDate(nextAppointment.startAt)}</span></p>
                {nextAppointment.location && <p className="mt-1 flex items-start gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {nextAppointment.location}</p>}
                {orderedAppointments.length > 1 && (
                  <div className="mt-4 border-t border-brand-100 pt-3">
                    <p className="text-xs font-medium text-slate-500">Mais {orderedAppointments.length - 1} compromisso(s) disponível(is) neste portal.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Nenhum compromisso foi agendado ou liberado para você.</div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-[#e7e0d3] bg-white p-5 shadow-[0_10px_30px_rgba(28,35,48,.06)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Arquivos compartilhados</p><h2 className="mt-1 text-xl font-bold text-slate-950">Seus documentos</h2></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{access.documents.length} disponível(is)</span>
          </div>
          {access.documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {access.documents.map(document => (
                <div key={document.id} className="group rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4 transition hover:border-brand-200 hover:shadow-sm">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="rounded-lg bg-slate-100 p-2.5 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-700"><FileText className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate" title={formatDocumentName(document.name)}>{formatDocumentName(document.name)}</p>
                      <p className="text-xs text-slate-500">{document.category} · {formatBytes(document.size)}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 gap-2" disabled={downloadingDocumentId === document.id} onClick={() => handleDownload(document.id, document.downloadUrl)} aria-label={`Baixar ${formatDocumentName(document.name)}`}>
                    <Download className="w-4 h-4" /><span className="hidden sm:inline">Baixar</span>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><FileText className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm font-medium text-slate-700">Nenhum documento compartilhado ainda</p><p className="mt-1 text-xs text-slate-500">Quando houver um arquivo disponível, ele aparecerá aqui.</p></div>
          )}
        </section>

        <footer className="flex flex-col gap-3 border-t border-[#ded6c8] py-6 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5"><img src="/branding/presenca-juridica-archetype-v2.png" alt="" className="h-7 w-7 object-contain" /><p>Este portal apresenta apenas informações liberadas para o seu acompanhamento.</p></div>
          <p className="flex items-center gap-1.5 text-brand-800"><ShieldCheck className="h-3.5 w-3.5" /> Acesso individual e controlado</p>
        </footer>
      </main>
    </div>
  );
};
