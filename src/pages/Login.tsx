import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, CircleCheck, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

const brandMark = '/branding/presenca-juridica-archetype-v2.png';

const workflowHighlights = [
  'Origem de cada contato preservada',
  'Histórico de conversas no contexto',
  'Próximas ações sempre visíveis',
];

const GoogleMark = () => (
  <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export const Login = () => {
  const { user, loading: authLoading, login, mfaChallengePending, completeMfaLogin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#05070c]">
        <div className="flex flex-col items-center gap-4">
          <img src={brandMark} alt="" className="h-20 w-20 object-contain" />
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#f2c778]" />
          <p className="text-sm font-medium text-slate-400">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/hoje" />;

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      if (await login()) navigate('/hoje');
    } catch (err) {
      console.error(err);
      setError('Não foi possível entrar. Verifique sua conta e tente novamente.');
      setLoading(false);
    }
  };

  const handleMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await completeMfaLogin(mfaCode);
      navigate('/hoje');
    } catch (err) {
      console.error(err);
      setError('Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070c] text-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{ backgroundImage: 'radial-gradient(circle at 11% 14%, rgba(0,91,255,.22), transparent 28%), radial-gradient(circle at 83% 78%, rgba(242,199,120,.10), transparent 24%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)', backgroundSize: '64px 64px' }}
      />

      <div className="relative mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,.92fr)]">
        <section className="login-brand-panel relative hidden min-h-screen overflow-hidden border-r border-white/10 px-12 py-10 lg:flex lg:flex-col lg:justify-between xl:px-20 xl:py-14">
          <header className="relative z-20 flex items-center gap-4">
            <img src={brandMark} alt="" className="h-14 w-14 object-contain drop-shadow-[0_0_20px_rgba(0,91,255,.35)]" />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-white">PRESENÇA JURÍDICA CRM</p>
              <p className="mt-1 text-[10px] font-medium tracking-[0.24em] text-[#f2c778]">INTELIGÊNCIA OPERACIONAL</p>
            </div>
          </header>

          <div aria-hidden="true" className="absolute -right-24 top-1/2 z-0 -translate-y-1/2 xl:-right-14">
            <div className="absolute inset-[18%] rounded-full bg-blue-600/30 blur-[90px]" />
            <div className="absolute inset-[28%] rounded-full bg-[#f2c778]/10 blur-[55px]" />
            <img src={brandMark} alt="" className="relative w-[430px] object-contain opacity-45 saturate-125 xl:w-[520px]" />
          </div>

          <div className="login-hero relative z-10 max-w-[610px] py-20">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#f2c778]/25 bg-[#f2c778]/[0.07] px-3.5 py-2 text-xs font-semibold tracking-[0.13em] text-[#f5d89f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f2c778] shadow-[0_0_12px_rgba(242,199,120,.9)]" />
              EQUILÍBRIO PARA DECIDIR. PRESENÇA PARA AGIR.
            </div>
            <h1 className="login-title max-w-[590px] text-5xl font-semibold leading-[1.03] tracking-[-0.045em] text-white xl:text-6xl">
              Sua operação jurídica não pode depender da memória.
            </h1>
            <p className="login-description mt-7 max-w-[520px] text-lg leading-8 text-slate-300">
              Transforme cada contato em contexto, cada compromisso em movimento e cada decisão em continuidade.
            </p>

            <ul className="login-highlights mt-10 grid max-w-[560px] gap-3 sm:grid-cols-2">
              {workflowHighlights.map((item, index) => (
                <li key={item} className={`flex items-center gap-3 border-t border-white/10 py-3 text-sm text-slate-200 ${index === 2 ? 'sm:col-span-2' : ''}`}>
                  <CircleCheck className="h-4 w-4 shrink-0 text-[#f2c778]" strokeWidth={1.8} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <footer className="login-footer relative z-20 flex items-center justify-between gap-6 border-t border-white/10 pt-6 text-xs text-slate-500">
            <span>
              <a className="transition hover:text-white" href="https://www.trekio-tecnologia.com.br/" target="_blank" rel="noreferrer">Tecnologia TrekIO</a>
              {' · '}
              <a className="transition hover:text-white" href="https://atominteligencia.com/" target="_blank" rel="noreferrer">Método ATOM</a>
            </span>
            <Link className="font-semibold text-slate-400 transition hover:text-white" to="/legal/privacidade">Política de Privacidade</Link>
          </footer>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(11,18,33,.4),rgba(3,6,12,.85))]" />
          <div className="relative w-full max-w-[470px]">
            <div className="mb-8 flex flex-col items-center text-center lg:hidden">
              <div className="relative">
                <div className="absolute inset-3 rounded-full bg-blue-500/30 blur-2xl" />
                <img src={brandMark} alt="Símbolo do Presença Jurídica" className="relative h-28 w-28 object-contain" />
              </div>
              <p className="mt-3 text-xs font-semibold tracking-[0.2em] text-[#f2c778]">PRESENÇA JURÍDICA CRM</p>
              <h1 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.03em] text-white">Sua rotina jurídica em equilíbrio.</h1>
            </div>

            <div className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_32px_90px_rgba(0,0,0,.48)] backdrop-blur-xl sm:p-9">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-brand-700">ACESSO AO ESCRITÓRIO</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Bem-vindo de volta.</h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">Entre com a conta Google autorizada para continuar sua operação.</p>
                </div>
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-50 text-amber-700 sm:flex">
                  <LockKeyhole className="h-5 w-5" strokeWidth={1.8} />
                </div>
              </div>

              <div className="mt-8">
                {error && (
                  <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-5 text-red-700">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <p>{error}</p>
                  </div>
                )}

                {!mfaChallengePending ? (
                  <Button type="button" onClick={handleLogin} disabled={loading} className="group h-14 w-full justify-between rounded-xl bg-[#073fbd] px-5 text-base font-semibold shadow-[0_12px_30px_rgba(0,58,153,.24)] hover:bg-[#06369f]">
                    <span className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                        {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-100 border-t-brand-700" /> : <GoogleMark />}
                      </span>
                      {loading ? 'Conectando...' : 'Entrar com Google'}
                    </span>
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                ) : (
                  <form className="space-y-4" onSubmit={handleMfa}>
                    <label className="block text-sm font-semibold text-slate-700" htmlFor="mfa-code">Código de verificação</label>
                    <input
                      id="mfa-code"
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      minLength={6}
                      maxLength={6}
                      aria-describedby="mfa-help"
                      className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-xl tracking-[0.42em] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                    <p id="mfa-help" className="text-xs text-slate-500">Digite os seis números do seu segundo fator.</p>
                    <Button className="h-12 w-full rounded-xl" disabled={loading || mfaCode.length !== 6}>{loading ? 'Verificando...' : 'Confirmar segundo fator'}</Button>
                  </form>
                )}
                <div id="mfa-signin-recaptcha" />
              </div>

              <div className="mt-7 border-t border-slate-200 pt-6">
                <p className="flex items-center gap-2 text-xs leading-5 text-slate-500">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-brand-700" />
                  Ambiente restrito a profissionais e equipes autorizadas.
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Com sua autorização, o Presença Jurídica usa os dados do Google Agenda somente para exibir e sincronizar os compromissos do seu escritório.
                </p>
                <nav aria-label="Documentos legais" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                  <Link className="transition hover:text-brand-700" to="/legal/termos">Termos</Link>
                  <Link className="transition hover:text-brand-700" to="/legal/privacidade">Política de Privacidade</Link>
                  <Link className="transition hover:text-brand-700" to="/legal/cookies">Cookies</Link>
                </nav>
              </div>
            </div>

            <p className="mt-6 text-center text-[11px] font-medium tracking-[0.12em] text-slate-600 lg:hidden">
              <a className="transition hover:text-slate-400" href="https://www.trekio-tecnologia.com.br/" target="_blank" rel="noreferrer">TECNOLOGIA TREKIO</a>
              {' · '}
              <a className="transition hover:text-slate-400" href="https://atominteligencia.com/" target="_blank" rel="noreferrer">MÉTODO ATOM</a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};
