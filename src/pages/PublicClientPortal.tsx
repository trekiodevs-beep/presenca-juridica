import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, Download, FileText, LockKeyhole, ShieldCheck } from 'lucide-react';
import { getClientPortalAccessByToken } from '../services/db';
import { ClientPortalAccess } from '../types';
import { Button } from '../components/ui/Button';
import { mockPortalAccesses } from '../mockData';

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

export const PublicClientPortal = () => {
  const { token } = useParams();
  const [access, setAccess] = useState<ClientPortalAccess | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-700">Portal do Cliente</p>
            <h1 className="text-xl font-bold text-slate-950">{access.clientName}</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-emerald-700">
            <ShieldCheck className="w-4 h-4" />
            Acesso controlado
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Status do atendimento</p>
          <h2 className="text-2xl font-bold text-slate-950">{access.statusLabel}</h2>
          {access.publicNotes && (
            <p className="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{access.publicNotes}</p>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-950 mb-4">Pendências</h2>
            {access.pendingItems.length > 0 ? (
              <ul className="space-y-3">
                {access.pendingItems.map((item, index) => (
                  <li key={`${item}-${index}`} className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nenhuma pendência aberta neste momento.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-950 mb-4">Agenda</h2>
            {access.appointments.length > 0 ? (
              <div className="space-y-3">
                {access.appointments.map(appointment => (
                  <div key={appointment.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-brand-700" />
                      <p className="text-sm font-semibold text-slate-900">{appointment.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(appointment.startAt).toLocaleString('pt-BR')}
                      {appointment.location ? ` · ${appointment.location}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nenhum compromisso liberado para visualização.</p>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-950 mb-4">Documentos</h2>
          {access.documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {access.documents.map(document => (
                <div key={document.id} className="rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{document.name}</p>
                      <p className="text-xs text-slate-500">{document.category} · {formatBytes(document.size)}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <a href={document.downloadUrl} target="_blank" rel="noreferrer" aria-label={`Baixar ${document.name}`}>
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nenhum documento liberado para visualização.</p>
          )}
        </section>
      </main>
    </div>
  );
};
