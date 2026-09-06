import React, { useEffect, useState } from 'react';

export const Status = () => {
  const healthUrl = import.meta.env.VITE_FUNCTIONS_HEALTH_URL as string | undefined;
  const [api, setApi] = useState<'checking' | 'ok' | 'degraded' | 'unconfigured'>('checking');
  useEffect(() => { if (!healthUrl) { setApi('unconfigured'); return; } fetch(healthUrl, { cache: 'no-store' }).then(response => setApi(response.ok ? 'ok' : 'degraded')).catch(() => setApi('degraded')); }, [healthUrl]);
  const label = api === 'ok' ? 'Operacional' : api === 'checking' ? 'Verificando…' : api === 'unconfigured' ? 'Monitor não configurado' : 'Indisponibilidade detectada';
  return <main className="min-h-screen bg-slate-50 px-5 py-12"><div className="mx-auto max-w-2xl"><h1 className="text-3xl font-bold text-slate-900">Status do Presença Jurídica</h1><p className="mt-2 text-slate-600">Verificação direta, sem afirmar disponibilidade quando o monitor não está configurado.</p><div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><span className="font-semibold text-slate-900">Aplicação e API</span><span className={api === 'ok' ? 'text-emerald-700' : api === 'degraded' ? 'text-red-700' : 'text-amber-700'}>{label}</span></div></div></div></main>;
};
