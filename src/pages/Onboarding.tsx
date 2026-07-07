import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { CheckCircle2, ChevronRight, Copy, ExternalLink, Play, Clock, MessageSquare, ArrowRight, Rocket } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { LeadSource, LeadStatus, Priority, LegalArea } from '../types';

export const Onboarding = () => {
  const { office, user } = useAuth();
  const { leads, events, addLead } = useData();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // 1. Profile Complete
  const isProfileComplete = Boolean(
    office && 
    office.name && 
    office.lawyerName && 
    office.whatsapp && 
    office.slug && 
    office.areas && 
    office.areas.length > 0
  );

  // 2. Public Link Ready
  const isPublicLinkReady = Boolean(office && office.slug);

  // 3. Test Contact Created
  const testContact = leads.find(l => l.source === 'Teste de Onboarding' || l.createdVia === 'onboarding_test');
  const isTestContactCreated = Boolean(testContact);

  // 4. Today Screen Validated
  const isTodayValidated = leads.length > 0;

  // 5. WhatsApp Validated
  const isWhatsappValidated = events.some(e => e.type === 'whatsapp_opened') || leads.some(l => l.lastWhatsappClickAt != null);

  const steps = [
    { completed: isProfileComplete },
    { completed: isPublicLinkReady },
    { completed: isTestContactCreated },
    { completed: isTodayValidated },
    { completed: isWhatsappValidated },
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const progressPercent = (completedSteps / steps.length) * 100;
  const isAllDone = completedSteps === steps.length;

  const handleCopyLink = () => {
    if (!office?.slug) return;
    const url = `${window.location.origin}/o/${office.slug}`;
    navigator.clipboard.writeText(url);
    showToast('Link público copiado com sucesso.', 'success');
  };

  const handleCreateTestContact = async () => {
    if (!office) return;
    
    try {
      await addLead({
        name: 'Contato de Teste',
        phone: office.whatsapp || '5535999999999',
        email: '',
        city: office.city || '',
        state: office.state || '',
        source: 'Teste de Onboarding' as LeadSource,
        area: (office.areas && office.areas.length > 0 ? office.areas[0] : 'Outro') as LegalArea,
        status: 'Novo contato' as LeadStatus,
        priority: 'Média' as Priority,
        summary: 'Contato criado para validar a jornada de onboarding do CRM.',
        notes: '',
        consentLgpd: true,
        createdVia: 'onboarding_test',
        publicFormSlug: office.slug
      });
      showToast('Contato de teste criado com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao criar contato de teste.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 pb-12">
      <PageHeader
        title="Primeiros passos"
        description="Configure seu escritório e valide a entrada de contatos no CRM em poucos minutos."
      />

      {/* Progress Bar Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-end mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Progresso da configuração</h3>
            <p className="text-xs text-slate-500 mt-1">{completedSteps} de {steps.length} etapas concluídas</p>
          </div>
          {isAllDone && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
            </span>
          )}
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-brand-600 rounded-full transition-all duration-500 ease-in-out" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {isAllDone && (
        <div className="bg-brand-50 border border-brand-200 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-brand-900 mb-2 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-brand-600" /> Seu CRM está pronto para receber contatos.
          </h2>
          <p className="text-brand-700 text-sm mb-6">
            Agora você pode usar seu link público no Instagram, WhatsApp, site ou landing page. Quando alguém preencher o formulário, o contato aparecerá automaticamente na Tela Hoje.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-brand-700 hover:bg-brand-800">
              <Link to="/canais">Ir para Canais</Link>
            </Button>
            <Button variant="outline" onClick={handleCopyLink} className="gap-2 bg-white text-brand-700 border-brand-200 hover:bg-brand-100">
              <Copy className="w-4 h-4" /> Copiar link público
            </Button>
            <Button variant="ghost" asChild className="text-brand-700 hover:text-brand-800 hover:bg-brand-100">
              <Link to="/">Ver Tela Hoje</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Step 1 */}
        <StepCard
          title="Complete o perfil do escritório"
          description="Esses dados são usados para gerar sua página pública, formulário e mensagens de atendimento."
          isCompleted={isProfileComplete}
          microcopy="Evite solicitar dados sensíveis no primeiro contato."
        >
          {isProfileComplete ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> Perfil configurado
            </span>
          ) : (
            <Button asChild className="gap-2">
              <Link to="/settings">
                Ir para Configurações <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          )}
        </StepCard>

        {/* Step 2 */}
        <StepCard
          title="Copie seu link público"
          description="Use este link no Instagram, WhatsApp, site ou redes sociais. O cliente não acessa o CRM; ele apenas envia o formulário público."
          isCompleted={isPublicLinkReady}
          microcopy="Você pode usar esse link mesmo sem ter site. A landing page é um upgrade, não um pré-requisito."
        >
          {isPublicLinkReady ? (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs sm:text-sm text-slate-600 break-all select-all">
                {window.location.origin}/o/{office?.slug}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCopyLink} className="gap-2 shrink-0">
                  <Copy className="w-4 h-4" /> Copiar link
                </Button>
                <Button variant="outline" asChild className="gap-2 shrink-0">
                  <a href={`/o/${office?.slug}`} target="_blank" rel="noopener noreferrer">
                    Abrir página pública <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-amber-600">Configure o slug público nas Configurações para gerar seu link.</p>
              <Button variant="outline" asChild>
                <Link to="/settings">Configurar slug</Link>
              </Button>
            </div>
          )}
        </StepCard>

        {/* Step 3 */}
        <StepCard
          title="Envie um contato de teste"
          description="Valide a jornada completa simulando uma pessoa entrando pelo seu link público."
          isCompleted={isTestContactCreated}
        >
          {isTestContactCreated ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="w-4 h-4" /> Contato de teste criado
              </span>
              <Button variant="outline" asChild size="sm">
                <Link to="/">Ver na Tela Hoje</Link>
              </Button>
              {testContact && (
                <Button variant="ghost" asChild size="sm">
                  <Link to={`/leads/${testContact.id}`}>Abrir contato</Link>
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={handleCreateTestContact} disabled={!isPublicLinkReady} className="gap-2">
              <Play className="w-4 h-4" /> Criar contato de teste
            </Button>
          )}
        </StepCard>

        {/* Step 4 */}
        <StepCard
          title="Confira a Tela Hoje"
          description="A Tela Hoje mostra os contatos que precisam de triagem, retorno ou próxima ação."
          isCompleted={isTodayValidated}
          microcopy="Quando um cliente real preencher seu formulário, ele aparecerá aqui como triagem pendente."
        >
          {isTodayValidated ? (
             <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
               <CheckCircle2 className="w-4 h-4" /> Contatos visualizados
             </span>
          ) : (
            <Button asChild variant="outline" className="gap-2">
              <Link to="/">
                Ver Tela Hoje <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          )}
        </StepCard>

        {/* Step 5 */}
        <StepCard
          title="Retorne pelo WhatsApp com histórico"
          description="Abra o contato no CRM, clique em WhatsApp e registre uma anotação. Assim o atendimento inicial fica rastreável."
          isCompleted={isWhatsappValidated}
          microcopy="O CRM não envia mensagens automáticas. Ele abre o WhatsApp com uma mensagem humanizada e registra a ação no histórico."
        >
          {isWhatsappValidated ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> WhatsApp validado
            </span>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link to="/leads">Ver contatos</Link>
              </Button>
              {testContact && (
                <Button asChild className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Link to={`/leads/${testContact.id}`}>
                    <MessageSquare className="w-4 h-4" /> Abrir contato de teste
                  </Link>
                </Button>
              )}
            </div>
          )}
        </StepCard>

      </div>
    </div>
  );
};

const StepCard = ({ 
  title, 
  description, 
  isCompleted, 
  microcopy, 
  children 
}: { 
  title: string; 
  description: string; 
  isCompleted: boolean; 
  microcopy?: string; 
  children: React.ReactNode; 
}) => {
  return (
    <div className={cn(
      "bg-white p-5 sm:p-6 rounded-2xl border transition-all",
      isCompleted ? "border-emerald-200 shadow-sm bg-emerald-50/10" : "border-slate-200 shadow-sm hover:border-slate-300"
    )}>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="shrink-0 mt-1">
          {isCompleted ? (
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className={cn("text-lg font-bold tracking-tight", isCompleted ? "text-slate-900" : "text-slate-900")}>
                {title}
              </h3>
              {isCompleted ? (
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Concluído
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Pendente
                </span>
              )}
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
          </div>
          
          <div>{children}</div>
          
          {microcopy && (
            <p className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg inline-block border border-slate-100">
              {microcopy}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
