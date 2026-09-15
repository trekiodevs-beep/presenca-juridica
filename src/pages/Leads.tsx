import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  LayoutGrid,
  MessageSquare,
  Plus,
  Search,
  UserRound,
  UserX,
  Users,
  WalletCards,
  Kanban as KanbanIcon,
} from 'lucide-react';
import { isPast, isToday, parseISO } from 'date-fns';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { KanbanBoard } from '../components/leads/KanbanBoard';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../context/ToastContext';
import { formatDateTime, formatPhoneForDisplay, formatPhoneForWhatsapp, cn } from '../lib/utils';
import { useData } from '../context/DataContext';
import { Lead } from '../types';

const statusOptions: Lead['status'][] = [
  'Novo contato',
  'Aguardando triagem',
  'Triagem realizada',
  'Aguardando informações',
  'Consulta agendada',
  'Proposta enviada',
  'Contratado',
  'Não avançou',
  'Arquivado',
];

const areaOptions: Lead['area'][] = [
  'Direito Trabalhista',
  'Direito de Família',
  'Direito do Consumidor',
  'Direito Previdenciário',
  'Direito Civil',
  'Direito Imobiliário',
  'Direito Empresarial',
  'Direito Sucessório',
  'Direito Contratual',
  'Direito Tributário',
  'Outro',
];

const sourceTone: Record<string, string> = {
  WhatsApp: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  Instagram: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/10',
  Site: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  'Landing Page': 'bg-indigo-50 text-indigo-700 ring-indigo-600/10',
  Indicação: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  'Cadastro Manual': 'bg-slate-100 text-slate-700 ring-slate-600/10',
  Outro: 'bg-slate-100 text-slate-700 ring-slate-600/10',
};

export const Leads = () => {
  const { leads, loading, documents, calendarEvents, financialRecords, portalAccesses } = useData();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');

  const [viewMode, setViewMode] = useState<'kanban' | 'cards'>(() => {
    const savedMode = localStorage.getItem('crm_contacts_view_mode');
    return savedMode === 'kanban' ? 'kanban' : 'cards';
  });

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term
        || lead.name.toLowerCase().includes(term)
        || lead.email?.toLowerCase().includes(term)
        || lead.phone.includes(term);
      const matchesStatus = statusFilter ? lead.status === statusFilter : true;
      const matchesArea = areaFilter ? lead.area === areaFilter : true;

      let matchesQuick = true;
      if (quickFilter === 'waiting') {
        matchesQuick = lead.status === 'Aguardando triagem' || lead.status === 'Novo contato';
      } else if (quickFilter === 'delayed') {
        matchesQuick = !!(lead.nextActionAt && isPast(parseISO(lead.nextActionAt)) && !isToday(parseISO(lead.nextActionAt)));
      } else if (quickFilter === 'unassigned') {
        matchesQuick = !lead.responsibleUserId;
      } else if (quickFilter === 'scheduled') {
        matchesQuick = lead.status === 'Consulta agendada';
      }

      return matchesSearch && matchesStatus && matchesArea && matchesQuick;
    });
  }, [areaFilter, leads, quickFilter, searchTerm, statusFilter]);

  const metrics = useMemo(() => {
    const waiting = leads.filter(lead => lead.status === 'Aguardando triagem' || lead.status === 'Novo contato').length;
    const delayed = leads.filter(lead => lead.nextActionAt && isPast(parseISO(lead.nextActionAt)) && !isToday(parseISO(lead.nextActionAt))).length;
    const scheduled = leads.filter(lead => lead.status === 'Consulta agendada').length;
    const contracted = leads.filter(lead => lead.status === 'Contratado').length;
    return { waiting, delayed, scheduled, contracted };
  }, [leads]);

  const handleSetViewMode = (mode: 'kanban' | 'cards') => {
    setViewMode(mode);
    localStorage.setItem('crm_contacts_view_mode', mode);
    showToast(`Visualização em ${mode === 'cards' ? 'cards' : 'por situação'} salva.`, 'info');
  };

  const getQuickFilterClass = (val: string) =>
    cn(
      'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border',
      quickFilter === val
        ? 'bg-brand-900 text-white border-brand-900 shadow-sm'
        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    );

  const getLeadSignals = (leadId: string) => {
    const documentCount = documents.filter(document => document.leadId === leadId).length;
    const appointmentCount = calendarEvents.filter(event => event.leadId === leadId && event.status === 'Agendado').length;
    const openFinancialCount = financialRecords.filter(record => record.leadId === leadId && record.status !== 'Pago' && record.status !== 'Cancelado').length;
    const hasPortal = portalAccesses.some(access => access.leadId === leadId && access.isActive);
    return { documentCount, appointmentCount, openFinancialCount, hasPortal };
  };

  const openWhatsapp = (lead: Lead) => {
    const waPhone = formatPhoneForWhatsapp(lead.phone);
    if (waPhone) {
      window.open(`https://wa.me/${waPhone}`, '_blank');
      return;
    }
    showToast('Telefone inválido ou não informado.', 'error');
  };

  const headerActions = (
    <div className="flex items-center gap-3">
      <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
        <button
          onClick={() => handleSetViewMode('kanban')}
          className={cn(
            'p-1.5 rounded-md transition-colors cursor-pointer',
            viewMode === 'kanban' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'
          )}
          title="Visualização por situação"
          aria-label="Visualização por situação"
        >
          <KanbanIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleSetViewMode('cards')}
          className={cn(
            'p-1.5 rounded-md transition-colors cursor-pointer',
            viewMode === 'cards' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'
          )}
          title="Visualização em cards"
          aria-label="Visualização em cards"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>

      <Button asChild className="gap-2 shrink-0 h-10 shadow-sm font-semibold cursor-pointer">
        <Link to="/leads/new">
          <Plus className="w-4 h-4" />
          Novo contato
        </Link>
      </Button>
    </div>
  );

  return (
    <div className={cn('space-y-6 mx-auto px-4 sm:px-6 pb-12', viewMode === 'kanban' ? 'max-w-[1600px]' : 'max-w-7xl')}>
      <PageHeader
        title="Contatos"
        description="Acompanhe entrada, triagem, retorno, documentos, agenda e financeiro dos clientes."
        breadcrumbItems={[{ label: 'Contatos' }]}
        actions={headerActions}
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => setQuickFilter('waiting')}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-amber-50 transition-colors"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <Clock className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none text-slate-950">{metrics.waiting}</span>
              <span className="text-xs font-medium text-slate-500">Triagem</span>
            </span>
          </button>
          <button
            onClick={() => setQuickFilter('delayed')}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-rose-50 transition-colors"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-50 text-rose-700">
              <UserX className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none text-slate-950">{metrics.delayed}</span>
              <span className="text-xs font-medium text-slate-500">Atrasados</span>
            </span>
          </button>
          <button
            onClick={() => setQuickFilter('scheduled')}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-blue-50 transition-colors"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <CalendarDays className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none text-slate-950">{metrics.scheduled}</span>
              <span className="text-xs font-medium text-slate-500">Consultas</span>
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('Contratado')}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-emerald-50 transition-colors"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <WalletCards className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none text-slate-950">{metrics.contracted}</span>
              <span className="text-xs font-medium text-slate-500">Contratados</span>
            </span>
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-2 [scrollbar-width:thin]">
        <button onClick={() => setQuickFilter('all')} className={getQuickFilterClass('all')}>Todos</button>
        <button onClick={() => setQuickFilter('waiting')} className={getQuickFilterClass('waiting')}>Aguardando triagem</button>
        <button onClick={() => setQuickFilter('delayed')} className={getQuickFilterClass('delayed')}>Atrasados</button>
        <button onClick={() => setQuickFilter('unassigned')} className={getQuickFilterClass('unassigned')}>Sem responsável</button>
        <button onClick={() => setQuickFilter('scheduled')} className={getQuickFilterClass('scheduled')}>Consulta agendada</button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="pl-9 bg-slate-50 border-slate-200 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-52 bg-slate-50 border-slate-200 h-10 text-sm"
          >
            <option value="">Todos os status</option>
            {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
          </Select>
          <Select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="w-full sm:w-52 bg-slate-50 border-slate-200 h-10 text-sm"
          >
            <option value="">Todas as áreas</option>
            {areaOptions.map(area => <option key={area} value={area}>{area}</option>)}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center flex flex-col items-center relative overflow-hidden">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100 relative z-10">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-1 relative z-10">Nenhum contato encontrado</h3>
          <p className="text-sm text-slate-500 mb-6 relative z-10">Tente ajustar seus filtros ou cadastre um novo contato.</p>
          <div className="relative z-10">
            <Button asChild variant="outline" className="bg-white">
              <Link to="/leads/new">Cadastrar novo contato</Link>
            </Button>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard leads={filteredLeads} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filteredLeads.map((lead) => {
            const signals = getLeadSignals(lead.id);
            const isActionDelayed = !!(lead.nextActionAt && isPast(parseISO(lead.nextActionAt)) && !isToday(parseISO(lead.nextActionAt)));
            const isActionToday = !!(lead.nextActionAt && isToday(parseISO(lead.nextActionAt)));

            return (
              <article
                key={lead.id}
                className={cn(
                  'group rounded-xl border bg-white shadow-sm hover:border-brand-200 hover:shadow-md transition-all overflow-hidden',
                  isActionDelayed ? 'border-rose-200' : isActionToday ? 'border-emerald-200' : 'border-slate-200'
                )}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-lg bg-slate-50 text-brand-700 flex items-center justify-center font-bold shrink-0 border border-slate-200">
                        {lead.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                        <Link to={`/leads/${lead.id}`} className="text-base font-bold text-slate-950 hover:text-brand-700 transition-colors line-clamp-1">
                          {lead.name}
                        </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>{lead.email || 'Sem e-mail'}</span>
                            <span className="font-mono">{formatPhoneForDisplay(lead.phone)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <PriorityBadge priority={lead.priority} />
                          <StatusBadge status={lead.status} />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">{lead.area}</span>
                        <span className={cn('inline-flex items-center rounded-md px-2 py-1 font-medium ring-1 ring-inset', sourceTone[lead.source] || sourceTone.Outro)}>
                          {lead.source}
                        </span>
                        {signals.hasPortal && (
                          <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 ring-1 ring-emerald-600/10">
                            Portal ativo
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-slate-500">Resumo</p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-700 line-clamp-2">
                            {lead.summary || 'Sem resumo inicial registrado.'}
                          </p>
                        </div>

                        <div className={cn(
                          'rounded-lg border px-3 py-2',
                          isActionDelayed ? 'border-rose-200 bg-rose-50' : isActionToday ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                        )}>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                            <Clock className="h-3.5 w-3.5" />
                            Próxima providência
                          </div>
                          {lead.nextActionText ? (
                            <>
                              <p className="mt-1 text-sm font-semibold text-slate-950 line-clamp-1">{lead.nextActionText}</p>
                              {lead.nextActionAt && <p className="mt-1 text-xs font-mono text-slate-500">{formatDateTime(lead.nextActionAt)}</p>}
                            </>
                          ) : (
                            <p className="mt-1 text-sm text-slate-500">Não definida.</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        {(signals.documentCount > 0 || signals.appointmentCount > 0 || signals.openFinancialCount > 0) && <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {signals.documentCount > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            {signals.documentCount} doc.
                          </span>
                          )}
                          {signals.appointmentCount > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {signals.appointmentCount} agenda
                          </span>
                          )}
                          {signals.openFinancialCount > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <WalletCards className="h-3.5 w-3.5" />
                            {signals.openFinancialCount} financeiro
                          </span>
                          )}
                        </div>}

                        <div className="flex items-center gap-2">
                          <button
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                            onClick={() => openWhatsapp(lead)}
                          >
                            <MessageSquare className="w-4 h-4" />
                            WhatsApp
                          </button>
                          <Button asChild variant="outline" className="h-9 gap-2">
                            <Link to={`/leads/${lead.id}`}>
                              Dossiê
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
