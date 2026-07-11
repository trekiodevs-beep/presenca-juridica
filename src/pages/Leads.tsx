import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Search, MessageSquare, ChevronRight, Plus, Users, LayoutList, Kanban as KanbanIcon } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { KanbanBoard } from '../components/leads/KanbanBoard';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../context/ToastContext';
import { formatPhoneForDisplay, formatPhoneForWhatsapp, formatDateTime } from '../lib/utils';
import { isToday, isPast, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

export const Leads = () => {
  const { leads, loading } = useData();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    return (localStorage.getItem('crm_contacts_view_mode') as 'kanban' | 'list') || 'list';
  });

  const handleSetViewMode = (mode: 'kanban' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('crm_contacts_view_mode', mode);
    showToast(`Visualização em ${mode === 'list' ? 'Lista' : 'Por situação'} salva.`, 'info');
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));
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

  const getQuickFilterClass = (val: string) => 
    `px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
      quickFilter === val 
        ? 'bg-brand-900 text-white shadow-sm' 
        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
    }`;

  const headerActions = (
    <div className="flex items-center gap-3">
      <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
        <button 
          onClick={() => handleSetViewMode('kanban')}
          className={cn(
            "p-1.5 rounded-md transition-colors cursor-pointer", 
            viewMode === 'kanban' ? "bg-white shadow-sm text-brand-700" : "text-slate-500 hover:text-slate-700"
          )}
          title="Visualização por situação"
          aria-label="Visualização por situação"
        >
          <KanbanIcon className="w-4 h-4" />
        </button>
        <button 
          onClick={() => handleSetViewMode('list')}
          className={cn(
            "p-1.5 rounded-md transition-colors cursor-pointer", 
            viewMode === 'list' ? "bg-white shadow-sm text-brand-700" : "text-slate-500 hover:text-slate-700"
          )}
          title="Visualização em Lista"
          aria-label="Visualização em Lista"
        >
          <LayoutList className="w-4 h-4" />
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
    <div className={cn("space-y-6 mx-auto px-4 sm:px-6 pb-12", viewMode === 'kanban' ? 'max-w-[1600px]' : 'max-w-7xl')}>
      <PageHeader
        title="Contatos"
        description="Acompanhe solicitações recebidas, triagem, retorno e próximas providências."
        breadcrumbItems={[{ label: 'Contatos' }]}
        actions={headerActions}
      />

      {/* Quick Filters */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar gap-2">
        <button onClick={() => setQuickFilter('all')} className={getQuickFilterClass('all')}>
          Todos
        </button>
        <button onClick={() => setQuickFilter('waiting')} className={getQuickFilterClass('waiting')}>
          Aguardando triagem
        </button>
        <button onClick={() => setQuickFilter('delayed')} className={getQuickFilterClass('delayed')}>
          Atrasados
        </button>
        <button onClick={() => setQuickFilter('unassigned')} className={getQuickFilterClass('unassigned')}>
          Sem responsável
        </button>
        <button onClick={() => setQuickFilter('scheduled')} className={getQuickFilterClass('scheduled')}>
          Consulta agendada
        </button>
      </div>

      {/* Main Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome ou e-mail..." 
            className="pl-9 bg-slate-50 border-slate-200 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-48 bg-slate-50 border-slate-200 h-10 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="Novo contato">Novo contato</option>
            <option value="Aguardando triagem">Aguardando triagem</option>
            <option value="Triagem realizada">Triagem realizada</option>
            <option value="Aguardando informações">Aguardando informações</option>
            <option value="Consulta agendada">Consulta agendada</option>
            <option value="Proposta enviada">Proposta enviada</option>
            <option value="Contratado">Contratado</option>
            <option value="Não avançou">Não avançou</option>
            <option value="Arquivado">Arquivado</option>
          </Select>
          <Select 
            value={areaFilter} 
            onChange={(e) => setAreaFilter(e.target.value)}
            className="w-full sm:w-48 bg-slate-50 border-slate-200 h-10 text-sm"
          >
            <option value="">Todas as áreas</option>
            <option value="Direito Trabalhista">Direito Trabalhista</option>
            <option value="Direito de Família">Direito de Família</option>
            <option value="Direito do Consumidor">Direito do Consumidor</option>
            <option value="Direito Previdenciário">Direito Previdenciário</option>
            <option value="Direito Civil">Direito Civil</option>
            <option value="Outros">Outros</option>
          </Select>
        </div>
      </div>

      {/* List / Cards */}
      {loading ? (
        <div className="flex h-64 items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center flex flex-col items-center relative overflow-hidden">
          <img 
            src="/atom_simbolo_transparente_clean.png" 
            alt="" 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 object-contain opacity-[0.03] pointer-events-none" 
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Área de atuação</th>
                  <th className="px-6 py-4">Origem do contato</th>
                  <th className="px-6 py-4">Situação</th>
                  <th className="px-6 py-4">Prioridade</th>
                  <th className="px-6 py-4">Próxima providência</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0 border border-brand-100">
                          {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <Link to={`/leads/${lead.id}`} className="font-semibold text-slate-900 hover:text-brand-700 transition-colors">
                            {lead.name}
                          </Link>
                          {lead.email && <div className="text-xs text-slate-400 mt-0.5">{lead.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{lead.area}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        {lead.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PriorityBadge priority={lead.priority} />
                    </td>
                    <td className="px-6 py-4">
                      {lead.nextActionText ? (
                        <div className="max-w-[200px]">
                          <p className="font-semibold text-slate-700 truncate">{lead.nextActionText}</p>
                          {lead.nextActionAt && (
                            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{formatDateTime(lead.nextActionAt)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="text-[#25D366] hover:bg-[#25D366]/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            const waPhone = formatPhoneForWhatsapp(lead.phone);
                            if (waPhone) {
                              window.open(`https://wa.me/${waPhone}`, '_blank');
                            } else {
                              showToast('Telefone inválido ou não informado.', 'error');
                            }
                          }}
                          title="Conversar no WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <Link 
                          to={`/leads/${lead.id}`} 
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Abrir detalhes"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-4 space-y-4 bg-slate-50">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <Link to={`/leads/${lead.id}`} className="font-bold text-slate-900 text-base hover:text-brand-700 transition-colors truncate block">
                      {lead.name}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="font-semibold text-slate-700">{lead.area}</span>
                      <span className="text-slate-300">•</span>
                      <span>{lead.source}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                    <StatusBadge status={lead.status} />
                    <PriorityBadge priority={lead.priority} />
                  </div>
                </div>

                {lead.nextActionText && (
                  <div className="text-xs bg-slate-50 border-l-2 border-brand-500 p-2.5 rounded-r-lg">
                    <p className="font-semibold text-slate-700 truncate">{lead.nextActionText}</p>
                    {lead.nextActionAt && (
                      <p className="text-slate-500 mt-0.5 font-mono">{formatDateTime(lead.nextActionAt)}</p>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 mt-1">
                  <span className="text-xs text-slate-400 font-mono">
                    {formatPhoneForDisplay(lead.phone)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white hover:bg-[#25D366]/90 transition-colors text-xs font-semibold cursor-pointer"
                      onClick={() => {
                        const waPhone = formatPhoneForWhatsapp(lead.phone);
                        if (waPhone) {
                          window.open(`https://wa.me/${waPhone}`, '_blank');
                        } else {
                          showToast('Telefone inválido ou não informado.', 'error');
                        }
                      }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                    <Link 
                      to={`/leads/${lead.id}`} 
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition-colors text-xs font-semibold"
                    >
                      Abrir
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
