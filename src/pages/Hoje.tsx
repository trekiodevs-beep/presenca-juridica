import React from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Users, AlertCircle, Clock, Calendar, CheckCircle2, ChevronRight, Plus, Route as RouteIcon, Link as LinkIcon, Smartphone, FileText, CircleDollarSign, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { isToday, isPast, parseISO } from 'date-fns';
import { formatDateTime } from '../lib/utils';
import { Button } from '../components/ui/Button';

export const Hoje = () => {
  const { leads, loading, tasks, documents, calendarEvents, financialRecords } = useData();
  const { user, office } = useAuth();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
      </div>
    );
  }

  // Metrics calculation
  const waitingTriage = leads.filter(l => l.status === 'Aguardando triagem' || l.status === 'Novo contato').length;
  const delayedActions = leads.filter(l => l.nextActionAt && isPast(parseISO(l.nextActionAt)) && !isToday(parseISO(l.nextActionAt))).length;
  const actionsToday = leads.filter(l => l.nextActionAt && isToday(parseISO(l.nextActionAt))).length;
  const calendarToday = calendarEvents.filter(event => event.status === 'Agendado' && isToday(parseISO(event.startAt))).length;
  const overdueFinancialRecords = financialRecords.filter(record => record.status === 'Vencido').length;
  const tasksToday = tasks.filter(task => !task.done && isToday(parseISO(task.dueAt))).length;
  const overdueTasks = tasks.filter(task => !task.done && isPast(parseISO(task.dueAt)) && !isToday(parseISO(task.dueAt))).length;

  const statCards = [
    { title: 'Aguardando triagem', value: waitingTriage, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { title: 'Providências vencidas', value: delayedActions + overdueTasks, icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
    { title: 'Tarefas hoje', value: actionsToday + calendarToday + tasksToday, icon: ListChecks, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { title: 'Financeiro vencido', value: overdueFinancialRecords, icon: CircleDollarSign, color: 'text-rose-600', bgColor: 'bg-rose-50' },
    { title: 'Documentos anexados', value: documents.length, icon: FileText, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  ];

  const priorityLeads = leads
    .filter(l => (l.nextActionAt && (isToday(parseISO(l.nextActionAt)) || isPast(parseISO(l.nextActionAt)))) || l.status === 'Novo contato' || l.status === 'Aguardando triagem')
    .sort((a, b) => {
      // Prioritize delayed actions
      if (a.nextActionAt && b.nextActionAt) return new Date(a.nextActionAt).getTime() - new Date(b.nextActionAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 8);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Advogado';

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6">
      <PageHeader
        title="Hoje"
        description={`Bom dia, ${firstName}. Aqui está sua rotina de atendimento para hoje.`}
        breadcrumbItems={[]}
        actions={
          <Button asChild className="gap-2 shrink-0 font-semibold cursor-pointer">
            <Link to="/leads/new">
              <Plus className="w-4 h-4" />
              Novo contato
            </Link>
          </Button>
        }
      />

      {(!office?.slug || leads.length === 0) && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-brand-900 font-bold mb-1">Configure sua entrada de contatos</h3>
            <p className="text-brand-700 text-sm">Copie seu link público, envie um contato de teste e veja como ele aparece aqui.</p>
          </div>
          <Button asChild className="shrink-0 bg-brand-700 hover:bg-brand-800 text-white font-semibold shadow-sm">
            <Link to="/onboarding">Ver primeiros passos</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat, idx) => (
          <Card key={idx} className="hover:shadow-md transition-shadow border-slate-200">
            <CardContent className="p-5 flex flex-col items-start gap-3">
              <div className={`p-2.5 rounded-lg ${stat.bgColor} ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 leading-none">{stat.value}</h3>
                <p className="text-xs font-medium text-slate-500 mt-1.5 uppercase tracking-wide">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Pontos de atenção de hoje</h2>
            <p className="text-sm text-slate-500">Contatos que precisam da sua atenção imediata.</p>
          </div>
          
          {priorityLeads.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {priorityLeads.map(lead => {
                  const isActionDelayed = lead.nextActionAt && isPast(parseISO(lead.nextActionAt)) && !isToday(parseISO(lead.nextActionAt));
                  const isActionToday = lead.nextActionAt && isToday(parseISO(lead.nextActionAt));
                  
                  return (
                    <li key={lead.id} className="hover:bg-slate-50 transition-colors">
                      <Link to={`/leads/${lead.id}`} className="flex items-center justify-between p-4 sm:px-6">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-sm font-semibold text-brand-900 truncate">{lead.name}</p>
                            {isActionDelayed && (
                              <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Atrasado</span>
                            )}
                            {isActionToday && (
                              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">Hoje</span>
                            )}
                            {(!lead.nextActionAt && (lead.status === 'Novo contato' || lead.status === 'Aguardando triagem')) && (
                              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/10">Aguardando triagem</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 truncate">
                            {lead.nextActionText || `Solicitação recebida em ${lead.area}`}
                          </p>
                          {lead.nextActionAt && (
                            <p className="text-[11px] text-slate-400 mt-1 font-mono">Agendado para: {formatDateTime(lead.nextActionAt)}</p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center relative overflow-hidden h-[300px] flex flex-col justify-center">
              <img 
                src="/atom_simbolo_transparente_clean.png" 
                alt="" 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 object-contain opacity-[0.03] pointer-events-none" 
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
              <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 relative z-10">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2 relative z-10">Nenhuma pendência crítica</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 relative z-10">
                Seu atendimento inicial está organizado hoje. Tudo certo por aqui!
              </p>
              <div className="relative z-10">
                <Button asChild variant="outline" className="bg-white">
                  <Link to="/leads/new">Cadastrar novo contato</Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Canais Conectados</h2>
            <Link to="/canais" className="text-sm font-medium text-brand-600 hover:text-brand-700">Ver canais</Link>
          </div>
          
          <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between min-h-[300px]">
            <CardContent className="p-0 divide-y divide-slate-100 flex-1">
              
              {/* Página Pública */}
              <div className="p-4 flex items-start gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                  <RouteIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">Página Pública</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${office?.slug ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {office?.slug ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate font-mono">
                    {office?.slug ? `/o/${office.slug}` : 'Configure um slug'}
                  </p>
                </div>
              </div>

              {/* Formulário Público */}
              <div className="p-4 flex items-start gap-3">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-lg shrink-0">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">Formulário Público</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${office?.slug ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {office?.slug ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate font-mono">
                    {office?.slug ? `/public/${office.slug}/contact` : 'Configure um slug'}
                  </p>
                </div>
              </div>

              {/* WhatsApp */}
              <div className="p-4 flex items-start gap-3">
                <div className="p-2 bg-[#25D366]/10 text-[#25D366] rounded-lg shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">WhatsApp</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${office?.whatsapp ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {office?.whatsapp ? 'Configurado' : 'Pendente'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {office?.whatsapp || 'Adicione o número do escritório'}
                  </p>
                </div>
              </div>

            </CardContent>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <Button asChild className="w-full bg-brand-700 hover:bg-brand-800 text-sm h-10">
                <Link to="/canais">Ver canais</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
