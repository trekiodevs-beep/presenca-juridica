import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  LinkIcon, Copy, ExternalLink, Instagram, Globe, 
  MessageSquare, Plus, CheckCircle2, ChevronRight, 
  Phone, Sparkles, Scale, Info
} from 'lucide-react';
import { createLead, addLeadEvent } from '../services/supabaseDb';
import { formatPhoneForDisplay, formatPhoneForWhatsapp } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';

export const Channels = () => {
  const { office, user } = useAuth();
  const { showToast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [creatingTest, setCreatingTest] = useState(false);
  const [testCreated, setTestCreated] = useState(false);

  if (!office) return null;

  const officeSlug = office.slug || 'seu-escritorio';
  const bioLink = `${window.location.origin}/o/${officeSlug}?source=Instagram&utm_source=instagram&utm_campaign=bio`;
  const publicPageLink = `${window.location.origin}/o/${officeSlug}`;
  const directFormLink = `${window.location.origin}/public/${officeSlug}/contact?source=Landing%20Page&utm_source=landing`;

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Link copiado com sucesso.', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateTest = async () => {
    if (!user) return;
    setCreatingTest(true);
    
    try {
      const leadId = await createLead({
        officeId: office.id,
        name: 'Contato de Teste',
        phone: office.whatsapp || '5535999999999',
        email: 'teste@exemplo.com',
        city: office.city || 'Cidade Teste',
        state: office.state || 'UF',
        source: 'Outro',
        area: office.areas[0] || 'Outro',
        status: 'Novo contato',
        priority: 'Média',
        summary: 'Contato criado para validar a jornada de entrada pública no CRM.',
        notes: '',
        consentLgpd: true,
        createdVia: 'test_button'
      });

      await addLeadEvent({
        officeId: office.id,
        leadId,
        type: 'created',
        description: 'Contato de teste criado pelo painel de Canais.',
        createdBy: user.id
      });

      setTestCreated(true);
      showToast('Contato de teste criado com sucesso.', 'success');
      setTimeout(() => setTestCreated(false), 5000);
    } catch (e) {
      console.error(e);
      showToast('Erro ao criar contato de teste.', 'error');
    } finally {
      setCreatingTest(false);
    }
  };

  const handleTestWhatsapp = () => {
    if (office.whatsapp) {
      const formatted = formatPhoneForWhatsapp(office.whatsapp);
      const text = encodeURIComponent("Olá! Este é um teste do canal de atendimento do CRM Presença Jurídica.");
      window.open(`https://wa.me/${formatted}?text=${text}`, '_blank');
    } else {
      showToast('Por favor, configure o WhatsApp do escritório nas Configurações.', 'error');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Canais de entrada"
        description="Use estes links para receber contatos no sistema mesmo sem ter um site pronto. Quando alguém preenche o formulário, o contato aparece automaticamente na aba Hoje."
        breadcrumbItems={[{ label: 'Canais de entrada' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleCreateTest} 
              disabled={creatingTest || testCreated} 
              variant="outline"
              className="gap-2 h-10 shrink-0 text-slate-700 border-slate-200 font-semibold cursor-pointer"
            >
              {testCreated ? (
                <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Contato de Teste Criado</span>
              ) : creatingTest ? (
                'Criando...'
              ) : (
                <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Criar contato de teste</span>
              )}
            </Button>
            {testCreated && (
              <Button asChild className="bg-brand-700 hover:bg-brand-800 h-10 font-semibold cursor-pointer">
                <a href="/">Ver na Tela Hoje</a>
              </Button>
            )}
          </div>
        }
      />

      <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-brand-900 font-bold mb-1">Primeira vez usando o CRM?</h3>
          <p className="text-brand-700 text-sm">Use o guia de primeiros passos para configurar seu link público e validar a jornada completa.</p>
        </div>
        <Button asChild className="shrink-0 bg-brand-700 hover:bg-brand-800 text-white font-semibold shadow-sm">
          <Link to="/onboarding">Abrir primeiros passos</Link>
        </Button>
      </div>

      {!office.slug && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-800 text-sm flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900 mb-1">Slug do escritório pendente</h4>
            <p className="leading-relaxed">
              Você precisa definir um Slug Público na tela de <strong>Configurações</strong> para que seus links públicos e páginas personalizadas funcionem corretamente.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Left column cards, Right column Visual Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (Plug & Play Links) */}
        <div className="lg:col-span-8 space-y-8">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Card 1 - Link para Instagram e redes sociais */}
            <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base text-slate-900 flex items-center gap-2 font-semibold">
                  <Instagram className="w-4 h-4 text-pink-600" />
                  Link para Instagram e redes sociais
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-600">
                    Use este link no Instagram, WhatsApp ou redes sociais.
                  </p>
                  <p className="mt-2 text-xs font-mono text-slate-400 bg-slate-50 p-2 rounded border border-slate-100 truncate">
                    {bioLink}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => handleCopyText(bioLink, 'bio')} 
                    variant="outline" 
                    size="sm"
                    className="flex-1 gap-1.5 h-9 text-xs"
                    disabled={!office.slug}
                  >
                    {copiedKey === 'bio' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'bio' ? 'Link copiado com sucesso.' : 'Copiar link'}
                  </Button>
                  <Button 
                    asChild 
                    variant="outline" 
                    size="sm"
                    className="flex-1 gap-1.5 h-9 text-xs"
                    disabled={!office.slug}
                  >
                    <a href={bioLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 2 - Página pública automática */}
            <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base text-slate-900 flex items-center gap-2 font-semibold">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Página pública automática
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-600">
                    Mini página automática para receber contatos mesmo sem landing page.
                  </p>
                  <p className="mt-2 text-xs font-mono text-slate-400 bg-slate-50 p-2 rounded border border-slate-100 truncate">
                    {publicPageLink}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => handleCopyText(publicPageLink, 'pubpage')} 
                    variant="outline" 
                    size="sm"
                    className="flex-1 gap-1.5 h-9 text-xs"
                    disabled={!office.slug}
                  >
                    {copiedKey === 'pubpage' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'pubpage' ? 'Link copiado com sucesso.' : 'Copiar link'}
                  </Button>
                  <Button 
                    asChild 
                    variant="outline" 
                    size="sm"
                    className="flex-1 gap-1.5 h-9 text-xs"
                    disabled={!office.slug}
                  >
                    <a href={publicPageLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 3 - Link para botão de site ou landing page */}
            <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base text-slate-900 flex items-center gap-2 font-semibold">
                  <LinkIcon className="w-4 h-4 text-brand-700" />
                  Link para botão de site ou landing page
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-600">
                    Use este link em botões de landing pages, sites ou anúncios.
                  </p>
                  <p className="mt-2 text-xs font-mono text-slate-400 bg-slate-50 p-2 rounded border border-slate-100 truncate">
                    {directFormLink}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => handleCopyText(directFormLink, 'direct')} 
                    variant="outline" 
                    size="sm"
                    className="flex-1 gap-1.5 h-9 text-xs"
                    disabled={!office.slug}
                  >
                    {copiedKey === 'direct' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'direct' ? 'Link copiado com sucesso.' : 'Copiar link'}
                  </Button>
                  <Button 
                    asChild 
                    variant="outline" 
                    size="sm"
                    className="flex-1 gap-1.5 h-9 text-xs"
                    disabled={!office.slug}
                  >
                    <a href={directFormLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 4 - WhatsApp */}
            <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  WhatsApp do escritório
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-600">
                    Canal usado para retorno ao contato.
                  </p>
                  <p className="mt-2 text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                    {office.whatsapp ? formatPhoneForDisplay(office.whatsapp) : 'Não configurado'}
                  </p>
                </div>
                <div className="pt-2">
                  <Button 
                    onClick={handleTestWhatsapp} 
                    variant="outline" 
                    size="sm"
                    className="w-full gap-1.5 h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Testar WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Section: Links por área de atuação */}
          {office.areas && office.areas.length > 0 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
                <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-brand-700" />
                  Links por área de atuação
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {office.areas.map((area, index) => {
                    const areaLink = `${window.location.origin}/o/${officeSlug}?source=Instagram&utm_source=instagram&utm_campaign=bio&area=${encodeURIComponent(area)}`;
                    const areaKey = `area-${index}`;
                    return (
                      <div key={area} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{area}</p>
                          <p className="text-xs text-slate-400 font-mono truncate max-w-md mt-0.5">
                            {areaLink}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button 
                            onClick={() => handleCopyText(areaLink, areaKey)} 
                            variant="outline" 
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            disabled={!office.slug}
                          >
                            {copiedKey === areaKey ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            {copiedKey === areaKey ? 'Link copiado com sucesso.' : 'Copiar link'}
                          </Button>
                          <Button 
                            asChild 
                            variant="outline" 
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            disabled={!office.slug}
                          >
                            <a href={areaLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" />
                              Abrir
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right Column (Visual Flow & Microcopy) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-slate-200 shadow-sm bg-slate-50 h-full">
            <CardHeader className="py-4 border-b border-slate-100">
              <CardTitle className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Como Funciona
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-brand-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                  Jornada Sem Atrito
                </p>
                <p className="text-brand-800 leading-relaxed">
                  O cliente não acessa o CRM. Ele apenas envia um formulário público. O contato aparece no painel interno do escritório.
                </p>
              </div>

              <div className="space-y-6">
                {/* Step 1 */}
                <div className="relative">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <Instagram className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Instagram / Redes</p>
                      <p className="text-xs text-slate-500">Cliente clica no seu link plug & play</p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-slate-200"></div>
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-brand-900 text-white border border-brand-900 flex items-center justify-center shadow-sm">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-900">Página / Formulário</p>
                      <p className="text-xs text-brand-700 font-semibold">Preenche com segurança os dados</p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-slate-200"></div>
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <Plus className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Contato no CRM</p>
                      <p className="text-xs text-slate-500">Notificado instantaneamente na Tela Hoje</p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-slate-200"></div>
                </div>

                {/* Step 4 */}
                <div className="relative">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center shadow-sm">
                      <MessageSquare className="w-5 h-5 text-[#25D366]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Retorno no WhatsApp</p>
                      <p className="text-xs text-slate-500">Atendimento humanizado com histórico</p>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};
