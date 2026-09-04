import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { 
  MessageSquare, Phone, Mail, MapPin, Calendar, Copy, User, 
  ShieldAlert, History, Hash, Check
} from 'lucide-react';
import { Select } from '../components/ui/Select';
import { LeadStatus } from '../types';
import { formatPhoneForDisplay, formatPhoneForWhatsapp, formatDateTime, humanizeSource } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../context/ToastContext';

export const LeadDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { leads, events, updateLead, addEvent } = useData();
  const { showToast } = useToast();

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
  const [isCopied, setIsCopied] = useState(false);

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
      description: `Situação atualizada de "${oldStatus}" para "${newStatus}"`,
      createdBy: user?.id || 'Sistema'
    });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await updateLead(lead.id, { notes: lead.notes ? `${lead.notes}\n\n${newNote}` : newNote });
    await addEvent({
      leadId: lead.id,
      type: 'note_added',
      description: `Anotação registrada: ${newNote.substring(0, 50)}${newNote.length > 50 ? '...' : ''}`,
      createdBy: user?.id || 'Sistema'
    });
    setNewNote('');
    showToast('Observação interna adicionada com sucesso.', 'success');
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
        description: nextActionText ? `Próxima providência definida: "${nextActionText}"` : 'Próxima providência removida',
        createdBy: user?.id || 'Sistema'
      });
      showToast('Próxima providência salva com sucesso.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar próxima providência.', 'error');
    } finally {
      setIsSavingAction(false);
    }
  };

  const getResponsibleLabel = () => {
    if (!lead.responsibleUserId) return 'Sem responsável definido';
    if (user && lead.responsibleUserId === user.id) return user.name;
    return lead.responsibleUserId;
  };

  const formattedSource = humanizeSource(lead.source);
  const whatsappMessage = `Olá, ${lead.name.split(' ')[0]}. Tudo bem?\n\nRecebemos sua solicitação ${formattedSource} sobre uma dúvida na área de ${lead.area}.\n\nPara organizar melhor o atendimento inicial, gostaria de confirmar algumas informações antes de encaminhar para análise da pessoa responsável.\n\nVocê poderia me informar brevemente o contexto da sua dúvida?`;

  const handleOpenWhatsapp = async () => {
    const waPhone = formatPhoneForWhatsapp(lead.phone);
    if (!waPhone) {
      showToast('Telefone inválido ou não informado.', 'error');
      return;
    }
    
    await updateLead(lead.id, { lastWhatsappClickAt: new Date().toISOString() });
    await addEvent({
      leadId: lead.id,
      type: 'whatsapp_opened',
      description: 'WhatsApp aberto pelo escritório',
      createdBy: user?.id || 'Sistema'
    });

    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
  };

  const generateSummaryText = () => {
    const lastEvent = leadEvents.length > 0 ? getEventTitle(leadEvents[0].type) : 'Nenhum evento encontrado';
    const nextAction = lead.nextActionText && lead.nextActionAt 
      ? `${lead.nextActionText} em ${new Date(lead.nextActionAt).toLocaleDateString('pt-BR')}` 
      : 'Sem próxima ação';
    
    return `Contato: ${lead.name}\nÁrea informada: ${lead.area}\nOrigem: ${lead.source}\nSituação atual: ${lead.status}\nPróxima ação: ${nextAction}\nÚltimo evento: ${lastEvent}`;
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(generateSummaryText());
    setIsCopied(true);
    showToast('Resumo copiado para a área de transferência!', 'success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getEventTitle = (type: string) => {
    switch (type) {
      case 'created': return 'Contato criado';
      case 'status_changed': return 'Situação atualizada';
      case 'responsible_assigned': return 'Responsável definido';
      case 'whatsapp_opened': return 'WhatsApp aberto';
      case 'note_added': return 'Anotação registrada';
      case 'action_created': return 'Próxima ação definida';
      case 'action_completed': return 'Tarefa concluída';
      default: return 'Evento do sistema';
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

  const isActionOverdue = lead.nextActionAt && new Date(lead.nextActionAt).getTime() < new Date().getTime();

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <PageHeader
        title="Dossiê do Contato"
        description="Acompanhamento do relacionamento e histórico do atendimento inicial."
        breadcrumbItems={[
          { label: 'Contatos', to: '/leads' },
          { label: 'Dossiê' }
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              onClick={handleCopySummary}
              variant="outline"
              className="gap-2 bg-white"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              Copiar resumo
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Identificação do Contato */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                  <User className="w-4 h-4" /> Responsável: {getResponsibleLabel()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={lead.status} />
                <PriorityBadge priority={lead.priority} />
              </div>
            </div>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Phone className="w-5 h-5 text-slate-400 shrink-0" />
                    <span className="font-mono font-medium">{formatPhoneForDisplay(lead.phone)}</span>
                  </div>
                  {lead.email && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-slate-700">
                    <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                    <span>{lead.city || 'Cidade não informada'}{lead.state ? `, ${lead.state}` : ''}</span>
                  </div>
                </div>
                <div className="p-6 space-y-4 bg-slate-50/50">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Área Jurídica</p>
                    <p className="font-medium text-brand-700">{lead.area}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ação Rápida</p>
                    <Button 
                      onClick={handleOpenWhatsapp} 
                      className="bg-[#25D366] hover:bg-[#1ebd5a] text-white border-transparent gap-2 shadow-sm w-full sm:w-auto h-9 px-4 text-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Retornar pelo WhatsApp
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Síntese do Atendimento Inicial */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-slate-900">Síntese do atendimento inicial</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {lead.summary ? (
                <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                  {lead.summary}
                </p>
              ) : (
                <p className="text-slate-500 italic text-sm">Nenhum resumo inicial registrado.</p>
              )}
            </CardContent>
          </Card>

          {/* Observações Internas */}
          <Card id="notes-section" className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-slate-900">Observações internas</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {lead.notes && (
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 mb-6">
                  <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                    {lead.notes}
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escreva uma nova observação sobre o andamento do atendimento..."
                  className="w-full rounded-xl border border-slate-300 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[100px] resize-y"
                />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-100/50 flex-1">
                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs leading-relaxed font-medium">
                      Registre apenas informações administrativas necessárias para organizar o atendimento inicial. Evite inserir documentos, números de processo ou dados sensíveis neste campo.
                    </p>
                  </div>
                  <Button onClick={handleAddNote} disabled={!newNote.trim()} className="bg-slate-800 hover:bg-slate-900 shrink-0">
                    Salvar observação
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rastreabilidade */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                <Hash className="w-4 h-4 text-slate-400" /> Rastreabilidade do contato
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Origem informada</p>
                  <p className="text-sm font-medium text-slate-900">{lead.source || 'Não informada'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Data de criação</p>
                  <p className="text-sm font-medium text-slate-900">{formatDateTime(lead.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Forma de captura</p>
                  <p className="text-sm font-medium text-slate-900">{lead.createdVia === 'public_form' ? 'Formulário público' : 'Cadastro manual'}</p>
                </div>
                {lead.utmCampaign && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Campanha (UTM)</p>
                    <p className="text-sm font-medium text-slate-900">{lead.utmCampaign}</p>
                  </div>
                )}
                {lead.utmSource && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Fonte (UTM)</p>
                    <p className="text-sm font-medium text-slate-900">{lead.utmSource}</p>
                  </div>
                )}
                <div className="sm:col-span-2 md:col-span-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Consentimento LGPD</p>
                  <p className="text-sm font-medium text-slate-900">
                    {lead.consentLgpd ? 'Sim, autorizado uso de dados para retorno e atendimento inicial.' : 'Não registrado / Cadastro manual.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column - Actions & Timeline */}
        <div className="space-y-6">
          
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className={`p-1 ${isActionOverdue ? 'bg-red-500' : lead.nextActionAt ? 'bg-brand-500' : 'bg-slate-200'}`}></div>
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-slate-900">Próxima ação e Situação</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                {lead.nextActionText && lead.nextActionAt ? (
                  <>
                    <div>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${isActionOverdue ? 'bg-red-50 text-red-700 ring-red-600/10' : 'bg-brand-50 text-brand-700 ring-brand-600/10'} mb-2`}>
                        {isActionOverdue ? 'Providência vencida' : 'Próxima providência'}
                      </span>
                      <p className="text-sm font-bold text-slate-900 leading-tight">
                        {lead.nextActionText}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-mono">
                      <Calendar className="w-4 h-4" /> {formatDateTime(lead.nextActionAt)}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm font-medium text-slate-500">Nenhuma próxima ação definida.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Atualizar Situação</label>
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
                <label className="block text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Definir próxima ação</label>
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
                    {isSavingAction ? 'Salvando...' : 'Salvar providência'}
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" /> Timeline Operacional
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {leadEvents.length > 0 ? (
                <div className="relative border-l-2 border-slate-200 pl-4 ml-2 space-y-6 pb-2 mt-2">
                  {leadEvents.map((evt) => (
                    <div key={evt.id} className="relative">
                      <span className={`absolute -left-[25px] top-1 flex h-3 w-3 rounded-full ${getEventColorClasses(evt.type)} ring-4 ring-white`} />
                      
                      <div className="space-y-1 mt-0.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 text-sm">
                            {getEventTitle(evt.type)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
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
                  <p className="text-sm text-slate-400">Nenhum evento encontrado.</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};
