import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { ArrowLeft, CheckCircle2, MessageSquare, Eye, Plus, ShieldAlert } from 'lucide-react';
import { LeadSource, LegalArea, Priority } from '../types';
import { cleanPhone, formatPhoneForDisplay, formatPhoneForWhatsapp } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../context/ToastContext';
import { CityStateFields } from '../components/CityStateFields';

export const NewLead = () => {
  const navigate = useNavigate();
  const { addLead } = useData();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successLeadId, setSuccessLeadId] = useState<string | null>(null);

  const initialFormData = {
    name: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    source: 'WhatsApp' as LeadSource,
    area: 'Direito de Família' as LegalArea,
    priority: 'Média' as Priority,
    summary: '',
    consentLgpd: false
  };

  const [formData, setFormData] = useState(initialFormData);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = cleanPhone(e.target.value);
    setFormData({ ...formData, phone: raw });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('O nome é obrigatório.');
      return;
    }

    if (!formData.phone.trim()) {
      setError('O WhatsApp é obrigatório.');
      return;
    }

    if (!formData.consentLgpd) {
      setError('É necessário confirmar o consentimento LGPD para prosseguir.');
      return;
    }

    setLoading(true);
    try {
      const newLead = await addLead({
        ...formData,
        status: 'Novo contato',
        notes: ''
      });
      showToast('Contato salvo com sucesso.', 'success');
      setSuccessLeadId(newLead || 'unknown');
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao salvar o contato. Tente novamente.');
      showToast('Erro ao salvar o contato. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setSuccessLeadId(null);
  };

  if (successLeadId) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto mt-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Contato registrado com sucesso</h2>
          <p className="text-slate-500 mb-8">O que você gostaria de fazer agora?</p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {successLeadId !== 'unknown' && (
              <Button asChild variant="outline" className="gap-2">
                <Link to={`/leads/${successLeadId}`}>
                  <Eye className="w-4 h-4" />
                  Ver contato
                </Link>
              </Button>
            )}
            <Button 
              variant="outline" 
              className="gap-2 text-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/10 border-slate-200"
              onClick={() => {
                const waPhone = formatPhoneForWhatsapp(formData.phone);
                if (waPhone) {
                  window.open(`https://wa.me/${waPhone}`, '_blank');
                }
              }}
            >
              <MessageSquare className="w-4 h-4" />
              Abrir WhatsApp
            </Button>
            <Button onClick={handleReset} className="gap-2 bg-brand-700 hover:bg-brand-800">
              <Plus className="w-4 h-4" />
              Cadastrar outro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 sm:px-6 pb-12">
      <PageHeader
        title="Novo contato"
        description="Registre apenas informações necessárias para organizar o atendimento inicial."
        breadcrumbItems={[
          { label: 'Contatos', to: '/leads' },
          { label: 'Novo contato' }
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-100 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <CardTitle className="text-base text-brand-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs">1</span>
              Identificação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome Completo *</label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="max-w-md" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp *</label>
                <Input required type="tel" value={formatPhoneForDisplay(formData.phone)} onChange={handlePhoneChange} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="sm:col-span-2">
                <CityStateFields
                  city={formData.city}
                  state={formData.state}
                  onCityChange={city => setFormData(current => ({ ...current, city }))}
                  onStateChange={state => setFormData(current => ({ ...current, state }))}
                  idPrefix="new-lead"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <CardTitle className="text-base text-brand-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs">2</span>
              Origem e área
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Origem *</label>
                <Select required value={formData.source} onChange={e => setFormData({...formData, source: e.target.value as LeadSource})}>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Site">Site</option>
                  <option value="Landing Page">Landing Page</option>
                  <option value="Indicação">Indicação</option>
                  <option value="Cadastro Manual">Cadastro Manual</option>
                  <option value="Outro">Outro</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Área Jurídica *</label>
                <Select required value={formData.area} onChange={e => setFormData({...formData, area: e.target.value as LegalArea})}>
                  <option value="Direito de Família">Direito de Família</option>
                  <option value="Direito Trabalhista">Direito Trabalhista</option>
                  <option value="Direito do Consumidor">Direito do Consumidor</option>
                  <option value="Direito Previdenciário">Direito Previdenciário</option>
                  <option value="Direito Civil">Direito Civil</option>
                  <option value="Outro">Outro</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <CardTitle className="text-base text-brand-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs">3</span>
              Atendimento inicial
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Prioridade de Atendimento</label>
              <Select required value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as Priority})} className="max-w-[200px]">
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Síntese do atendimento inicial</label>
              <textarea
                value={formData.summary}
                onChange={e => setFormData({...formData, summary: e.target.value})}
                className="w-full rounded-xl border border-slate-300 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[120px] resize-y"
                placeholder="Descreva brevemente o que o contato busca..."
              />
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Evite registrar dados sensíveis desnecessários no resumo inicial.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.consentLgpd}
                  onChange={e => setFormData({ ...formData, consentLgpd: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                />
                <span className="text-sm text-slate-700 leading-relaxed">
                  Confirmo que o contato forneceu consentimento (ou há base legal válida) para armazenamento e tratamento de seus dados pessoais para fins de atendimento (LGPD).
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" disabled={loading} asChild className="px-6">
            <Link to="/leads">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={loading} className="px-8 bg-brand-700 hover:bg-brand-800">
            {loading ? 'Salvando...' : 'Salvar contato'}
          </Button>
        </div>
      </form>
    </div>
  );
};
