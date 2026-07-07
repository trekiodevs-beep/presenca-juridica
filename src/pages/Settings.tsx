import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { createOffice, updateOffice as dbUpdateOffice, updatePublicForm } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Building2, MessageSquare, ShieldAlert, Link as LinkIcon, Copy, ExternalLink, Globe } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../context/ToastContext';

const DEFAULT_AREAS = ['Direito de Família', 'Direito Trabalhista', 'Direito do Consumidor', 'Direito Empresarial'];

export const Settings = () => {
  const { office, user, updateUserOfficeId, setOffice } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Link copiado com sucesso.', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const [formData, setFormData] = useState({
    name: '',
    lawyerName: '',
    oab: '',
    email: '',
    whatsapp: '',
    city: '',
    state: '',
    slug: ''
  });

  useEffect(() => {
    if (office) {
      setFormData({
        name: office.name || '',
        lawyerName: office.lawyerName || '',
        oab: office.oab || '',
        email: office.email || '',
        whatsapp: office.whatsapp || '',
        city: office.city || '',
        state: office.state || '',
        slug: office.slug || ''
      });
    }
  }, [office]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents
    value = value.replace(/[^a-z0-9-]/g, '-'); // replace non-alphanumeric with hyphen
    value = value.replace(/-+/g, '-'); // remove multiple hyphens
    value = value.replace(/^-|-$/g, ''); // remove leading/trailing hyphens
    setFormData({ ...formData, slug: value });
  };

  const generateSlug = (name: string) => {
    let value = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    value = value.replace(/[^a-z0-9-]/g, '-');
    value = value.replace(/-+/g, '-');
    value = value.replace(/^-|-$/g, '');
    return value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setSuccess(false);
    try {
      const finalSlug = formData.slug || generateSlug(formData.name);
      const dataToSave = { ...formData, slug: finalSlug };

      if (!office) {
        const newOfficeId = await createOffice({
          ...dataToSave,
          areas: DEFAULT_AREAS as any
        });
        
        await updatePublicForm(finalSlug, {
          officeId: newOfficeId,
          officeName: dataToSave.name,
          lawyerName: dataToSave.lawyerName,
          whatsapp: dataToSave.whatsapp,
          email: dataToSave.email,
          city: dataToSave.city,
          state: dataToSave.state,
          areas: DEFAULT_AREAS as any,
          isActive: true
        });

        await updateUserOfficeId(newOfficeId);
        navigate('/');
      } else {
        await dbUpdateOffice(office.id, dataToSave);
        
        await updatePublicForm(finalSlug, {
          officeId: office.id,
          officeName: dataToSave.name,
          lawyerName: dataToSave.lawyerName,
          whatsapp: dataToSave.whatsapp,
          email: dataToSave.email,
          city: dataToSave.city,
          state: dataToSave.state,
          areas: office.areas,
          isActive: true
        });

        setOffice({ ...office, ...dataToSave, updatedAt: new Date().toISOString() });
        setSuccess(true);
        showToast('Configurações salvas com sucesso!', 'success');
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Error saving office:", error);
      showToast('Erro ao salvar as configurações.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 pb-12">
      <PageHeader
        title="Configurações"
        description={office ? 'Personalize a identificação e mensagens do seu escritório.' : 'Para começar, preencha os dados básicos do seu escritório.'}
        breadcrumbItems={[{ label: 'Configurações' }]}
      />

      {success && (
        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <p className="font-medium text-sm">Configurações salvas com sucesso!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <CardTitle className="text-base text-brand-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-700" />
              Dados Principais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do Escritório *</label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Silva & Associados" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Advogado(a) Principal *</label>
                <Input required value={formData.lawyerName} onChange={e => setFormData({...formData, lawyerName: e.target.value})} placeholder="Seu nome" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Número da OAB</label>
                <Input value={formData.oab} onChange={e => setFormData({...formData, oab: e.target.value})} placeholder="UF000000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail de Contato *</label>
                <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contato@escritorio.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp Principal</label>
                <Input value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} placeholder="(00) 00000-0000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cidade</label>
                  <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">UF</label>
                  <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} maxLength={2} placeholder="SP" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Slug Público do Escritório</label>
                <div className="flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                    /public/
                  </span>
                  <Input 
                    value={formData.slug} 
                    onChange={handleSlugChange} 
                    placeholder="marcela-advocacia" 
                    className="rounded-l-none"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                    /contact
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5" />
                  Link público do seu formulário de contato. Use apenas letras minúsculas, números e hífen.
                </p>

                {(formData.slug || office?.slug) && (
                  <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Links Plug and Play Prontos</h4>
                    
                    {/* Link 1: Página Pública */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <span className="flex items-center gap-1 font-semibold text-slate-900">
                          <Globe className="w-3.5 h-3.5 text-indigo-600" />
                          Página Pública do Escritório
                        </span>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => handleCopyText(`${window.location.origin}/o/${formData.slug || office?.slug}`, 'pub')}
                            className="text-brand-700 hover:text-brand-900 flex items-center gap-1 font-semibold"
                          >
                            {copiedKey === 'pub' ? 'Link copiado com sucesso.' : 'Copiar'}
                          </button>
                          <span className="text-slate-300">|</span>
                          <a 
                            href={`${window.location.origin}/o/${formData.slug || office?.slug}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-brand-700 hover:text-brand-900 flex items-center gap-1 font-semibold"
                          >
                            Abrir
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 font-mono bg-white p-2 rounded border border-slate-100 truncate">
                        {`${window.location.origin}/o/${formData.slug || office?.slug}`}
                      </p>
                    </div>

                    {/* Link 2: Formulário Direto */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <span className="flex items-center gap-1 font-semibold text-slate-900">
                          <LinkIcon className="w-3.5 h-3.5 text-brand-700" />
                          Formulário Direto
                        </span>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => handleCopyText(`${window.location.origin}/public/${formData.slug || office?.slug}/contact`, 'form')}
                            className="text-brand-700 hover:text-brand-900 flex items-center gap-1 font-semibold"
                          >
                            {copiedKey === 'form' ? 'Link copiado com sucesso.' : 'Copiar'}
                          </button>
                          <span className="text-slate-300">|</span>
                          <a 
                            href={`${window.location.origin}/public/${formData.slug || office?.slug}/contact`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-brand-700 hover:text-brand-900 flex items-center gap-1 font-semibold"
                          >
                            Abrir
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 font-mono bg-white p-2 rounded border border-slate-100 truncate">
                        {`${window.location.origin}/public/${formData.slug || office?.slug}/contact`}
                      </p>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {office && (
              <div className="pt-6 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-3">Áreas de Atuação Registradas</label>
                <div className="flex flex-wrap gap-2">
                  {office.areas.map((area, idx) => (
                    <span key={idx} className="bg-brand-50 text-brand-700 px-3 py-1.5 rounded-md text-xs font-medium border border-brand-100">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {office && (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-brand-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-700" />
                Comunicação com o Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Mensagem Padrão de WhatsApp</label>
              <p className="text-sm text-slate-500 mb-4">Esta é a mensagem inicial que o sistema gera para você contatar um novo contato. Ela usa uma linguagem humanizada, acolhedora e ética.</p>
              
              <div className="bg-[#EFEAE2] p-4 rounded-xl max-w-lg shadow-sm border border-slate-200 relative">
                <div className="absolute top-0 right-0 w-4 h-4 bg-[#EFEAE2] rotate-45 -mr-2 mt-4 border-t border-r border-slate-200 hidden sm:block"></div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  "Olá, [Nome]. Tudo bem?
                  
                  Recebemos seu contato [Origem] sobre uma dúvida na área de [Área].
                  
                  Para organizar melhor o atendimento inicial, gostaria de confirmar algumas informações antes de encaminhar para análise da pessoa responsável.
                  
                  Você poderia me informar brevemente o contexto da sua dúvida?"
                </p>
              </div>

              <div className="mt-4 flex items-start gap-2 text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                 <p className="text-xs leading-relaxed">
                   No momento, este texto é padronizado para garantir conformidade ética e clareza no primeiro contato.
                 </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={loading} className="px-8 bg-brand-700 hover:bg-brand-800 shadow-sm">
            {loading ? 'Salvando...' : (office ? 'Salvar Perfil' : 'Criar Escritório')}
          </Button>
        </div>
      </form>
    </div>
  );
};
