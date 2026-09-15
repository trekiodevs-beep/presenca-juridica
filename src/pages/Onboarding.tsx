import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Copy, ExternalLink, HelpCircle, MessageSquare, Play, Rocket, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { getOnboardingState } from '../services/supabaseDb';
import type { OnboardingState } from '../types';
import { cn } from '../lib/utils';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export const Onboarding = () => {
  const { office } = useAuth();
  const { leads, tasks, calendarEvents, createOnboardingExampleContact } = useData();
  const { showToast } = useToast();
  const [remoteState, setRemoteState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingExample, setCreatingExample] = useState(false);

  const localState = useMemo<OnboardingState>(() => {
    const officeReady = Boolean(office?.name && office.lawyerName && office.whatsapp && office.slug && office.areas?.length);
    const firstContactReady = leads.some(lead => !lead.archivedAt);
    const firstActionReady = tasks.length > 0 || calendarEvents.some(event => !event.deletedAt) || leads.some(lead => lead.nextActionAt);
    return { version: 2, officeId: office?.id || '', milestones: { officeReady, firstContactReady, firstActionReady }, optional: { googleCalendarConnected: false }, nextAction: !officeReady ? 'office' : !firstContactReady ? 'first_contact' : !firstActionReady ? 'first_action' : 'activated', recommendations: [] };
  }, [calendarEvents, leads, office, tasks]);

  const state = remoteState || localState;
  const milestones = [
    { key: 'officeReady', title: 'Prepare o espaço', description: 'Nome, responsável, WhatsApp e link público para o sistema saber como apresentar seu atendimento.', href: '/settings', action: 'Configurar espaço', icon: Settings2 },
    { key: 'firstContactReady', title: 'Conheça o fluxo com um contato', description: 'Use um exemplo seguro ou receba seu primeiro contato. Nada real é enviado automaticamente.', href: '/onboarding', action: 'Criar exemplo', icon: MessageSquare },
    { key: 'firstActionReady', title: 'Registre a próxima providência', description: 'Uma tarefa ou compromisso transforma o contato em trabalho organizado.', href: '/tarefas', action: 'Registrar providência', icon: ArrowRight },
  ] as const;
  const completed = milestones.filter(item => state.milestones[item.key]).length;
  const activeIndex = milestones.findIndex(item => !state.milestones[item.key]);
  const nextIndex = activeIndex < 0 ? milestones.length - 1 : activeIndex;
  const testContact = leads.find(lead => lead.createdVia === 'onboarding_example');

  useEffect(() => {
    if (USE_MOCK || !office?.id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void getOnboardingState().then(result => { if (!cancelled) setRemoteState(result); }).catch(error => { console.error('Onboarding state unavailable:', error); showToast('Não conseguimos atualizar o progresso agora. Mostrando o estado local.', 'error'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [office?.id, showToast]);

  const refreshState = async () => { if (!USE_MOCK) { try { setRemoteState(await getOnboardingState()); } catch (error) { console.error(error); } } };
  const handleCreateExample = async () => {
    if (creatingExample) return;
    setCreatingExample(true);
    try { await createOnboardingExampleContact(); await refreshState(); showToast('Exemplo criado. Agora abra o contato e registre uma ação.', 'success'); }
    catch (error) { console.error(error); showToast('Não foi possível criar o exemplo. Tente novamente.', 'error'); }
    finally { setCreatingExample(false); }
  };
  const copyPublicLink = async () => { if (!office?.slug) return; await navigator.clipboard.writeText(`${window.location.origin}/o/${office.slug}`); showToast('Link público copiado.', 'success'); };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-12 sm:px-6">
      <PageHeader title="Vamos deixar seu espaço pronto" description="Siga só os três passos essenciais. O restante pode ser configurado quando fizer sentido para você." />
      <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5 shadow-sm sm:p-7" aria-labelledby="activation-title">
        <div className="flex items-start gap-4"><div className="rounded-full bg-white p-3 text-brand-700"><Rocket className="h-6 w-6" aria-hidden="true" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-brand-700">{loading ? 'Atualizando seu progresso…' : `${completed} de 3 passos essenciais`}</p><h2 id="activation-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{state.nextAction === 'activated' ? 'Seu espaço está pronto para trabalhar.' : 'Comece pelo próximo passo.'}</h2><p className="mt-2 max-w-2xl text-base leading-7 text-slate-700">Você não precisa entender todas as configurações agora. Faça uma coisa por vez; o sistema acompanha o que falta.</p></div></div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={3} aria-label="Progresso dos passos essenciais"><div className="h-full rounded-full bg-brand-700 transition-all" style={{ width: `${(completed / 3) * 100}%` }} /></div>
      </section>
      <section className="space-y-4" aria-labelledby="steps-title"><div><h2 id="steps-title" className="text-xl font-bold text-slate-950">Passos essenciais</h2><p className="mt-1 text-base text-slate-600">A próxima providência fica destacada para você não se perder.</p></div>
        {milestones.map((item, index) => { const isCompleted = state.milestones[item.key]; const isNext = !isCompleted && index === nextIndex; const Icon = item.icon; return <article key={item.key} className={cn('rounded-2xl border bg-white p-5 shadow-sm sm:p-6', isNext ? 'border-brand-400 ring-2 ring-brand-100' : isCompleted ? 'border-emerald-200' : 'border-slate-200')}><div className="flex gap-4"><div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', isCompleted ? 'bg-emerald-100 text-emerald-700' : isNext ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500')}>{isCompleted ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <Icon className="h-6 w-6" aria-hidden="true" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-slate-950">{index + 1}. {item.title}</h3>{isCompleted && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Concluído</span>}{isNext && <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800">Próximo passo</span>}</div><p className="mt-1 text-base leading-7 text-slate-600">{item.description}</p><div className="mt-4 flex flex-wrap gap-3">{item.key === 'firstContactReady' && !isCompleted ? <Button type="button" size="lg" onClick={handleCreateExample} disabled={creatingExample} className="gap-2"><Play className="h-5 w-5" aria-hidden="true" />{creatingExample ? 'Criando…' : item.action}</Button> : <Button asChild size="lg" variant={isNext ? 'default' : 'outline'}><Link to={item.href}>{isCompleted ? 'Abrir etapa' : item.action}<ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" /></Link></Button>}{item.key === 'firstContactReady' && testContact && <Button asChild size="lg" variant="outline"><Link to={`/leads/${testContact.id}`}>Abrir exemplo</Link></Button>}</div></div></div></article>; })}
      </section>
      {state.nextAction === 'activated' && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><h2 className="flex items-center gap-2 text-xl font-bold text-emerald-950"><CheckCircle2 className="h-6 w-6" aria-hidden="true" />Pronto para receber contatos</h2><p className="mt-2 text-base leading-7 text-emerald-900">Agora você pode divulgar seu link. O sistema continuará sugerindo melhorias sem bloquear seu trabalho.</p>{office?.slug && <div className="mt-4 flex flex-wrap gap-3"><Button type="button" size="lg" onClick={copyPublicLink} className="gap-2"><Copy className="h-5 w-5" aria-hidden="true" />Copiar link público</Button><Button asChild size="lg" variant="outline"><a href={`/o/${office.slug}`} target="_blank" rel="noopener noreferrer">Abrir página pública <ExternalLink className="ml-2 h-5 w-5" aria-hidden="true" /></a></Button></div>}</section>}
      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer list-none text-lg font-bold text-slate-950"><span className="inline-flex items-center gap-2"><HelpCircle className="h-5 w-5 text-brand-700" aria-hidden="true" />Configurações opcionais</span><span className="ml-2 text-sm font-normal text-slate-500">(você pode fazer depois)</span></summary><div className="mt-5 grid gap-3 sm:grid-cols-3"><OptionalLink href="/settings#integrations" title="Google Agenda" text={state.optional.googleCalendarConnected ? 'Conectada' : 'Conecte quando quiser'} /><OptionalLink href="/equipe" title="Equipe" text="Convide pessoas" /><OptionalLink href="/portal" title="Portal do cliente" text="Compartilhe atualizações" /></div></details>
      <p className="flex items-start gap-2 text-sm leading-6 text-slate-500"><HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Precisa de ajuda? Comece pelo passo destacado. Se algo não fizer sentido, abra a etapa e o sistema explica o que é necessário.</p>
    </div>
  );
};

const OptionalLink = ({ href, title, text }: { href: string; title: string; text: string }) => <Link to={href} className="rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50"><p className="font-semibold text-slate-900">{title}</p><p className="mt-1 text-sm text-slate-600">{text}</p></Link>;
