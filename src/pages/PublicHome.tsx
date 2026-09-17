import React from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ShieldCheck, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

const benefits = [
  {
    icon: UsersRound,
    title: 'Relacionamento com contexto',
    description: 'Centralize contatos, histórico de conversas e próximas ações do escritório.',
  },
  {
    icon: CalendarDays,
    title: 'Compromissos sincronizados',
    description: 'Exiba e sincronize compromissos autorizados com a agenda selecionada.',
  },
  {
    icon: ShieldCheck,
    title: 'Operação com controle',
    description: 'Organize tarefas, permissões, auditoria e dados por escritório.',
  },
];

export const PublicHome = () => (
  <main className="min-h-screen bg-[#05070c] text-white">
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-16">
      <header className="flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-3" aria-label="Presença Jurídica CRM - página inicial">
          <img src="/branding/presenca-juridica-logo-v3.png" alt="" className="h-12 w-12 object-contain" />
          <span>
            <span className="block text-sm font-bold tracking-[0.16em]">PRESENÇA JURÍDICA CRM</span>
            <span className="mt-1 block text-[10px] font-medium tracking-[0.22em] text-[#f2c778]">INTELIGÊNCIA OPERACIONAL</span>
          </span>
        </Link>
        <Link to="/login" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/40 hover:text-white">
          Acessar o CRM <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#f2c778]/30 bg-[#f2c778]/10 px-3 py-2 text-xs font-semibold tracking-[0.12em] text-[#f5d89f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f2c778]" />
            ORGANIZAÇÃO PARA ESCRITÓRIOS
          </p>
          <h1 className="mt-7 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">
            Presença Jurídica CRM: contexto para cada decisão do escritório.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            O Presença Jurídica CRM é um software de apoio à organização comercial e operacional de escritórios. Ele reúne contatos, histórico, tarefas e compromissos em um fluxo de trabalho com permissões e registros de operação.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-[#073fbd] px-5 py-3 text-sm font-semibold shadow-lg shadow-blue-950/40 transition hover:bg-[#0b4edb]">
              Entrar com Google <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/legal/privacidade" className="inline-flex items-center rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/40 hover:text-white">
              Ver Política de Privacidade
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-blue-950/20 sm:p-8">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <img src="/branding/presenca-juridica-logo-v3.png" alt="Símbolo do Presença Jurídica CRM" className="h-20 w-20 object-contain" />
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#f2c778]">PARA EQUIPES AUTORIZADAS</p>
              <h2 className="mt-2 text-2xl font-semibold">Uma operação visível.</h2>
            </div>
          </div>
          <ul className="mt-6 space-y-5">
            {['Origem dos contatos preservada', 'Próximas ações sempre visíveis', 'Compromissos no contexto do escritório'].map(item => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#f2c778]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="features-title" className="border-t border-white/10 py-12">
        <h2 id="features-title" className="text-2xl font-semibold">O que o aplicativo oferece</h2>
        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Icon className="h-5 w-5 text-[#f2c778]" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6 text-xs text-slate-400">
        <span>Presença Jurídica CRM · Trekio Tecnologia</span>
        <nav aria-label="Documentos legais" className="flex flex-wrap gap-4 font-semibold">
          <Link to="/legal/privacidade" className="hover:text-white">Política de Privacidade</Link>
          <Link to="/legal/termos" className="hover:text-white">Termos de Uso</Link>
          <Link to="/legal/cookies" className="hover:text-white">Cookies</Link>
        </nav>
      </footer>
    </div>
  </main>
);
