import React, { useState } from 'react';
import { Lead } from '../../types';
import { useData } from '../../context/DataContext';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageSquare, GripVertical } from 'lucide-react';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { formatPhoneForDisplay, formatPhoneForWhatsapp, formatDateTime } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface KanbanBoardProps {
  leads: Lead[];
}

const COLUMNS = [
  'Novo contato',
  'Aguardando triagem',
  'Triagem realizada',
  'Aguardando informações',
  'Consulta agendada',
  'Proposta enviada',
  'Contratado',
  'Não avançou',
  'Arquivado'
];

export const KanbanBoard = ({ leads }: KanbanBoardProps) => {
  const { updateLead } = useData();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLeadId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== column) {
      setDragOverColumn(column);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (!id) return;
    
    setDraggedLeadId(null);
    
    const lead = leads.find(l => l.id === id);
    if (lead && lead.status !== status) {
      // Optmistic update happens naturally if we trigger the update
      await updateLead(id, { status: status as Lead['status'] });
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-280px)] min-h-[500px] hide-scrollbar">
      {COLUMNS.map(column => {
        const columnLeads = leads.filter(l => l.status === column);
        const isDragOver = dragOverColumn === column;
        
        return (
          <div 
            key={column} 
            className={cn(
              "flex-shrink-0 w-80 rounded-xl border flex flex-col h-full overflow-hidden transition-colors",
              isDragOver ? "bg-brand-50 border-brand-300" : "bg-slate-50/50 border-slate-200"
            )}
            onDragOver={(e) => handleDragOver(e, column)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column)}
          >
            <div className="p-3 border-b border-slate-200 bg-slate-100/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-700">{column}</h3>
              <span className="bg-white text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                {columnLeads.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {columnLeads.map(lead => (
                <div 
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onDragEnd={() => setDraggedLeadId(null)}
                  className={cn(
                    "bg-white rounded-lg border border-slate-200 p-4 shadow-sm cursor-grab active:cursor-grabbing hover:border-brand-300 transition-colors relative group",
                    draggedLeadId === lead.id && "opacity-50"
                  )}
                >
                  <div className="absolute top-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  
                  <div className="flex justify-between items-start mb-2 pr-5">
                    <PriorityBadge priority={lead.priority} />
                  </div>

                  <div className="mb-3">
                    <Link to={`/leads/${lead.id}`} className="block">
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-brand-700 transition-colors line-clamp-2">
                        {lead.name}
                      </h4>
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-1.5">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{lead.area}</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 truncate max-w-[80px]">{lead.source}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-slate-600 font-mono">
                      {formatPhoneForDisplay(lead.phone)}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        className="text-[#25D366] hover:bg-[#25D366]/10 p-1 rounded-md transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
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
                      
                      <Link 
                        to={`/leads/${lead.id}`} 
                        className="text-brand-500 hover:text-brand-700 hover:bg-brand-50 p-1 rounded-md transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                  
                  {lead.nextActionText && (
                    <div className="mt-3 text-[11px] border-l-2 border-brand-500 pl-2 py-0.5 bg-brand-50/50 rounded-r-sm">
                      <p className="font-medium text-slate-700 truncate">{lead.nextActionText}</p>
                      {lead.nextActionAt && (
                        <p className="text-slate-500 mt-0.5 font-mono">{formatDateTime(lead.nextActionAt)}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {columnLeads.length === 0 && (
                <div className="h-full min-h-[100px] border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-sm text-slate-400 font-medium">
                  Solte aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
