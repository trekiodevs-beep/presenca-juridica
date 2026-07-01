import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Search, Filter, MessageSquare, ChevronRight, Plus, Users, Clock, AlertCircle, LayoutList, Kanban as KanbanIcon } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { KanbanBoard } from '../components/leads/KanbanBoard';
import { formatPhoneForDisplay, formatPhoneForWhatsapp, formatDateTime } from '../lib/utils';
import { isToday, isPast, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

export const Leads = () => {
  const { leads, loading } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

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
    `px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
      quickFilter === val 
        ? 'bg-brand-900 text-white shadow-sm' 
        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
    }`;

  return (
    <div className={cn("space-y-6 mx-auto px-4 sm:px-6 pb-12", viewMode === 'kanban' ? 'max-w-[1600px]' : 'max-w-7xl')}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leads e Contatos</h1>
          <p className="text-slate-500 mt-1 text-sm">Acompanhe todos os contatos recebidos e mantenha cada próximo passo registrado.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('kanban')}
              className={cn("p-1.5 rounded-md transition-colors", viewMode === 'kanban' ? "bg-white shadow-sm text-brand-700" : "text-slate-500 hover:text-slate-700")}
              title="Visualização em Kanban"
            >
              <KanbanIcon className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded-md transition-colors", viewMode === 'list' ? "bg-white shadow-sm text-brand-700" : "text-slate-500 hover:text-slate-700")}
              title="Visualização em Lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
          
          <Button asChild className="gap-2 shrink-0 h-10 shadow-sm">
            <Link to="/leads/new">
              <Plus className="w-4 h-4" />
              Novo contato
            </Link>
          </Button>
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all flex flex-col group relative">
              
              <div className="flex justify-between items-start mb-3">
                <StatusBadge status={lead.status} />
                <PriorityBadge priority={lead.priority} />
              </div>

              <div className="mb-4">
                <Link to={`/leads/${lead.id}`} className="block">
                  <h3 className="font-bold text-slate-900 text-lg group-hover:text-brand-700 transition-colors line-clamp-1">{lead.name}</h3>
                </Link>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span>{lead.area}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>{lead.source}</span>
                </div>
              </div>

              <div className="space-y-2 mb-5 flex-1">
                <div className="text-sm text-slate-600 flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  <span className="font-mono">{formatPhoneForDisplay(lead.phone)}</span>
                  <button 
                    className="text-[#25D366] hover:bg-[#25D366]/10 p-1.5 rounded-md transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      const waPhone = formatPhoneForWhatsapp(lead.phone);
                      if (waPhone) {
                        window.open(`https://wa.me/${waPhone}`, '_blank');
                      } else {
                        alert('Telefone inválido ou não informado.');
                      }
                    }}
                    title="Conversar no WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>

                {lead.nextActionText && (
                  <div className="text-xs border-l-2 border-brand-500 pl-3 py-1">
                    <p className="font-medium text-slate-700 truncate">{lead.nextActionText}</p>
                    {lead.nextActionAt && (
                      <p className="text-slate-500 mt-0.5 font-mono">{formatDateTime(lead.nextActionAt)}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {lead.city || 'S/ Cidade'}
                </p>
                <Link 
                  to={`/leads/${lead.id}`} 
                  className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
                >
                  Ver detalhes
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

