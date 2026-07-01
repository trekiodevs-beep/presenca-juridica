import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LinkIcon, Copy, ExternalLink, ArrowRight, Instagram, Globe, MessageSquare, Plus, CheckCircle2 } from 'lucide-react';
import { createLead, addLeadEvent } from '../services/db';

export const Channels = () => {
  const { office, user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  const [testCreated, setTestCreated] = useState(false);

  if (!office) return null;

  const publicLink = `${window.location.origin}/public/${office.slug || 'seu-escritorio'}/contact`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateTest = async () => {
    if (!user) return;
    setCreatingTest(true);
    
    try {
      const leadId = await createLead({
        officeId: office.id,
        name: 'Lead de Teste',
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
        description: 'Lead de teste criado pelo painel de Canais.',
        createdBy: user.id
      });

      setTestCreated(true);
      setTimeout(() => setTestCreated(false), 5000);
    } catch (e) {
      console.error(e);
      alert('Erro ao criar lead de teste.');
    } finally {
      setCreatingTest(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 pb-12">
      <div className="border-b border-slate-100 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Entrada de Contatos</h1>
        <p className="text-slate-500 mt-1">
          Entenda como os contatos chegam ao CRM a partir da landing page, Instagram, site ou link público.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-brand-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-brand-700" />
                Link público do escritório
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!office.slug ? (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-800 text-sm mb-4">
                  Você precisa configurar um Slug Público na tela de <strong>Configurações</strong> para usar o link.
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Use este link na bio do seu Instagram, no botão da sua landing page ou envie diretamente para os clientes preencherem.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-600 font-mono truncate flex items-center">
                      {publicLink}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCopy} variant="outline" className="shrink-0 gap-2 w-full sm:w-auto">
                        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado!' : 'Copiar link'}
                      </Button>
                      <Button asChild variant="outline" className="shrink-0 gap-2 w-full sm:w-auto">
                        <a href={publicLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                          Abrir formulário
                        </a>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm overflow-hidden bg-gradient-to-br from-slate-50 to-white">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Simular Jornada do Cliente</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto">
                  Veja na prática como o contato chega para você após preencher o formulário.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center space-y-4 max-w-sm mx-auto">
                <Button 
                  onClick={handleCreateTest} 
                  disabled={creatingTest || testCreated} 
                  className="w-full bg-brand-700 hover:bg-brand-800 h-12 shadow-sm"
                >
                  {testCreated ? (
                    <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Lead criado</span>
                  ) : creatingTest ? (
                    'Criando...'
                  ) : (
                    <span className="flex items-center gap-2"><Plus className="w-5 h-5" /> Criar lead de teste</span>
                  )}
                </Button>

                {testCreated && (
                  <Button asChild variant="outline" className="w-full">
                    <a href="/">Ver na Tela Hoje</a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="border-slate-200 shadow-sm bg-slate-50 h-full">
            <CardHeader className="py-4">
              <CardTitle className="text-sm text-slate-500 uppercase tracking-wider font-semibold">
                Fluxo Visual
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-6">
                
                {/* Step 1 */}
                <div className="relative">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <Instagram className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Landing Page / Instagram</p>
                      <p className="text-xs text-slate-500">Cliente clica no seu link</p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-slate-200"></div>
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center shadow-sm">
                      <Globe className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-900">Formulário público</p>
                      <p className="text-xs text-brand-600/80">Preenche os dados iniciais</p>
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
                      <p className="text-sm font-medium text-slate-900">Novo contato no CRM</p>
                      <p className="text-xs text-slate-500">Entra na sua Tela Hoje</p>
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
                      <p className="text-sm font-medium text-slate-900">WhatsApp</p>
                      <p className="text-xs text-slate-500">Você inicia o atendimento</p>
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
