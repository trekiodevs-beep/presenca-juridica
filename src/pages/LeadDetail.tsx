import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { ArrowLeft, MessageSquare, Phone, Mail, MapPin, Calendar, Clock, Copy, User, ChevronRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Select } from '../components/ui/Select';
import { LeadStatus } from '../types';
import { formatPhoneForDisplay, formatPhoneForWhatsapp, formatDateTime, humanizeSource } from '../lib/utils';

export const LeadDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { leads, events, updateLead, addEvent } = useData();
  const lead = leads.find(l => l.id === id);
  const leadEvents = events
    .filter(e => e.leadId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [newNote, setNewNote] = useState('');
  const [nextActionText, setNextActionText] = useState(lead?.nextActionText || '');
  const [nextActionAt, setNextActionAt] = useState(
    lead?.nextActionAt ? new Date(lead.nextActionAt).toISOString().substring(0, 16) : ''
  );
  const [isSavingAction, setIsSavingAction] = useState(false);

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 mt-12 max-w-xl mx-auto">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6 text-slate-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Contato não encontrado</h2>
        <p className="text-slate-500 mb-6 text-center text-sm">Este contato não existe ou foi removido.</p>
        <Button asChild variant="outline">
          <Link to="/leads">Voltar para lista</Link>
        </Button>
      </div>
    );
  }

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as LeadStatus;
    const oldStatus = lead.status;
    await updateLead(lead.id, { status: newStatus });
    await addEvent({
      leadId: lead.id,
      type: 'status_changed',
      description: `Status alterado de "${oldStatus}" para "${newStatus}"`,
      createdBy: user?.id || 'Sistema'
    });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await updateLead(lead.id, { notes: lead.notes ? `${lead.notes}\n\n${newNote}` : newNote });
    await addEvent({
      leadId: lead.id,
      type: 'note_added',
      description: `Nota adicionada: ${newNote.substring(0, 50)}${newNote.length > 50 ? '...' : ''}`,
      createdBy: user?.id || 'Sistema'
    });
    setNewNote('');
  };

  const handleSaveNextAction = async () => {
    setIsSavingAction(true);
    try {
      const isoDate = nextActionAt ? new Date(nextActionAt).toISOString() : '';
      await updateLead(lead.id, {
        nextActionText: nextActionText || undefined,
        nextActionAt: isoDate || undefined
      });
      await addEvent({
        leadId: lead.id,
        type: 'action_created',
        description: nextActionText ? `Próxima ação agendada: "${nextActionText}"` : 'Próxima ação removida',
        createdBy: user?.id || 'Sistema'
      });
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar próxima ação.');
    } finally {
      setIsSavingAction(false);
    }
  };

  const getResponsibleLabel = () => {
    if (!lead.responsibleUserId) return 'Sem responsável';
    if (user && lead.responsibleUserId === user.id) return user.name;
    return lead.responsibleUserId;
  };

  // Humanized and natural WhatsApp message template
  const formattedSource = humanizeSource(lead.source);
  const whatsappMessage = `Olá, ${lead.name.split(' ')[0]}. Tudo bem?\n\nRecebemos seu contato ${formattedSource} sobre uma dúvida na área de ${lead.area}.\n\nPara organizar melhor o atendimento inicial, gostaria de confirmar algumas informações antes de encaminhar para análise da pessoa responsável.\n\nVocê poderia me informar brevemente o contexto da sua dúvida?`;

  const handleOpenWhatsapp = async () => {
    const waPhone = formatPhoneForWhatsapp(lead.phone);
    if (!waPhone) {
      alert('Telefone inválido ou não informado.');
      return;
    }
    await updateLead(lead.id, { lastWhatsappClickAt: new Date().toISOString() });
    await addEvent({
      leadId: lead.id,
      type: 'whatsapp_opened',
      description: 'WhatsApp aberto via sistema',
      createdBy: user?.id || 'Sistema'
    });
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    alert('Mensagem copiada para a área de transferência!');
  };

  const getEventTitle = (type: string) => {
    switch (type) {
      case 'created': return 'Contato Cadastrado';
      case 'status_changed': return 'Mudança de Status';
      case 'responsible_assigned': return 'Responsável Atribuído';
      case 'whatsapp_opened': return 'Atendimento via WhatsApp';
      case 'note_added': return 'Nota Interna Adicionada';
      case 'action_created': return 'Próxima Ação Agendada';
      case 'action_completed': return 'Ação Concluída';
      default: return 'Evento';
    }
  };

  const getEventColorClasses = (type: string) => {
    switch (type) {
      case 'created': return 'bg-blue-500';
      case 'status_changed': return 'bg-indigo-500';
      case 'whatsapp_opened': return 'bg-[#25D366]';
      case 'note_added': return 'bg-amber-500';
      case 'action_created': return 'bg-brand-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      
      {/* Top Navigation */}
      <div className="flex items-center gap-2 mb-2">
        <Link to="/leads" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
          Leads e Contatos
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-900">Detalhes</span>
      </div>

      {/* Header Profile */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">{lead.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="font-medium text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-md">{lead.area}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {lead.city || 'Sem cidade'} {lead.state ? `/ ${lead.state}` : ''}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> Origem: {lead.source}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <StatusBadge status={lead.status} />
          <PriorityBadge priority={lead.priority} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Highlight: Próxima Melhor Ação */}
          <div className="bg-brand-900 rounded-2xl p-6 shadow-md text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-800 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50" />
            
            <div className="relative z-10">
              <h2 className="text-sm font-semibold text-brand-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Próxima melhor ação
              </h2>
              
              <div className="mb-6">
                {lead.nextActionText ? (
                  <>
                    <p className="text-xl sm:text-2xl font-bold leading-tight mb-2 text-white">
                      {lead.nextActionText}
                    </p>
                    {lead.nextActionAt && (
                      <p className="text-brand-200 font-mono text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Agendado para: {formatDateTime(lead.nextActionAt)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xl font-medium text-brand-200">
                    Nenhuma ação definida para este contato.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={handleOpenWhatsapp} 
                  className="bg-[#25D366] hover:bg-[#1ebd5a] text-white border-transparent gap-2 shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  Abrir WhatsApp
                </Button>
                <Button 
                  onClick={() => document.getElementById('notes-section')?.scrollIntoView({ behavior: 'smooth' })} 
                  variant="outline" 
                  className="bg-transparent border-brand-700 text-white hover:bg-brand-800 hover:text-white"
                >
                  Registrar anotação
                </Button>
                <Button 
                  onClick={handleCopyMessage} 
                  variant="ghost" 
                  className="text-brand-300 hover:text-white hover:bg-brand-800"
                >
                  Copiar template
                </Button>
              </div>
            </div>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-brand-900">Resumo do Contato</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {lead.summary ? (
                <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                  {lead.summary}
                </p>
              ) : (
                <p className="text-slate-500 italic text-sm">Nenhum resumo inicial cadastrado.</p>
              )}
              
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100/50">
                 <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                 <p className="text-xs leading-relaxed font-medium">
                   A análise jurídica deve ser feita por profissional habilitado. Evite registrar dados sensíveis desnecessários.
                 </p>
              </div>
            </CardContent>
          </Card>

          <Card id="notes-section" className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-brand-900">Anotações Internas</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {lead.notes && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                  <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                    {lead.notes}
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escreva uma nova anotação sobre o andamento..."
                  className="w-full rounded-xl border border-slate-300 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[100px] resize-y"
                />
                <Button onClick={handleAddNote} disabled={!newNote.trim()} className="bg-slate-800 hover:bg-slate-900">
                  Salvar anotação
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions & Timeline */}
        <div className="space-y-6">
          
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-brand-900">Próximos Passos</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Status Atual</label>
                <Select value={lead.status} onChange={handleStatusChange} className="w-full text-sm">
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
              </div>

              <div className="pt-5 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Agendar Próxima Ação</label>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">O que fazer a seguir?</label>
                    <input
                      type="text"
                      placeholder="Ex: Ligar para confirmar dados"
                      value={nextActionText}
                      onChange={(e) => setNextActionText(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Data e Hora</label>
                    <input
                      type="datetime-local"
                      value={nextActionAt}
                      onChange={(e) => setNextActionAt(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <Button 
                    onClick={handleSaveNextAction} 
                    variant="outline" 
                    className="w-full text-sm"
                    disabled={isSavingAction}
                  >
                    {isSavingAction ? 'Salvando...' : 'Salvar agendamento'}
                  </Button>
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100">
                 <h4 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Dados de Contato</h4>
                 <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-mono">{formatPhoneForDisplay(lead.phone)}</span>
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-3 text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Responsável: {getResponsibleLabel()}</span>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-brand-900">Histórico de Atividades</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {leadEvents.length > 0 ? (
                <div className="relative border-l-2 border-slate-100 pl-4 ml-2 space-y-6 pb-2 mt-2">
                  {leadEvents.map((evt) => (
                    <div key={evt.id} className="relative">
                      <span className={`absolute -left-[25px] top-1 flex h-3 w-3 rounded-full ${getEventColorClasses(evt.type)} ring-4 ring-white`} />
                      
                      <div className="space-y-1 mt-0.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 text-sm">
                            {getEventTitle(evt.type)}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatDateTime(evt.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                          {evt.description}
                        </p>
                        {evt.createdBy && (
                          <p className="text-[11px] text-slate-400 italic pt-1">
                            Por: {evt.createdBy === user?.id ? user.name : evt.createdBy}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400">Nenhuma atividade registrada ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
