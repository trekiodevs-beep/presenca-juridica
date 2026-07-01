import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getPublicFormBySlug, createLead, addLeadEvent } from '../services/db';
import { PublicForm as PublicFormType } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Building2, MessageSquare, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { formatPhoneForDisplay, formatPhoneForWhatsapp } from '../lib/utils';

export const PublicForm = () => {
  const { officeSlug } = useParams<{ officeSlug: string }>();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [officeForm, setOfficeForm] = useState<PublicFormType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    area: '',
    summary: '',
    consentLgpd: false,
    company: '' // honeypot
  });

  useEffect(() => {
    const loadForm = async () => {
      if (!officeSlug) return;
      try {
        const form = await getPublicFormBySlug(officeSlug);
        if (form && form.isActive) {
          setOfficeForm(form);
          
          // Pre-fill area if valid
          const areaParam = searchParams.get('area');
          if (areaParam && form.areas.includes(areaParam as any)) {
            setFormData(prev => ({ ...prev, area: areaParam }));
          }
        } else {
          setError('Formulário indisponível no momento.');
        }
      } catch (err) {
        setError('Ocorreu um erro ao carregar o formulário.');
      } finally {
        setLoading(false);
      }
    };
    loadForm();
  }, [officeSlug, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeForm) return;

    // Honeypot check
    if (formData.company) {
      setSuccess(true);
      return;
    }

    setSubmitting(true);
    try {
      const source = searchParams.get('source') || 'Formulário Público';
      
      const leadData = {
        officeId: officeForm.officeId,
        name: formData.name,
        phone: formData.phone.replace(/\D/g, ''),
        email: formData.email,
        city: formData.city,
        state: formData.state,
        area: formData.area as any,
        summary: formData.summary,
        notes: '',
        consentLgpd: formData.consentLgpd,
        source: source as any,
        status: 'Novo contato' as const,
        priority: 'Média' as const,
        responsibleUserId: null,
        nextActionText: null,
        nextActionAt: null,
        lastWhatsappClickAt: null,
        createdVia: 'public_form',
        publicFormSlug: officeSlug,
        utmSource: searchParams.get('utm_source') || null,
        utmMedium: searchParams.get('utm_medium') || null,
        utmCampaign: searchParams.get('utm_campaign') || null,
        archivedAt: null,
      };

      await createLead(leadData as any);
      
      setSuccess(true);
    } catch (err: any) {
      console.error('Falha ao enviar formulário público:', err?.message || err);
      alert('Não foi possível enviar agora. Confira sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsapp = () => {
    if (officeForm?.whatsapp) {
      const formatted = formatPhoneForWhatsapp(officeForm.whatsapp);
      const text = encodeURIComponent("Olá. Acabei de enviar um contato pelo formulário público e gostaria de confirmar o recebimento.");
      window.open(`https://wa.me/${formatted}?text=${text}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
      </div>
    );
  }

  if (error || !officeForm) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Ops!</h2>
          <p className="text-slate-500">{error || 'Formulário não encontrado.'}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Contato enviado com sucesso</h2>
            <p className="text-slate-500">
              O escritório <strong>{officeForm.officeName}</strong> recebeu sua solicitação e poderá retornar pelos canais informados.
            </p>
          </div>
          
          <div className="space-y-3 pt-4">
            {officeForm.whatsapp && (
              <Button onClick={handleWhatsapp} className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2">
                <MessageSquare className="w-5 h-5" />
                Continuar pelo WhatsApp
              </Button>
            )}
            <Button variant="outline" onClick={() => setSuccess(false)} className="w-full">
              Enviar outro contato
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto bg-brand-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-brand-700">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{officeForm.officeName}</h1>
          {officeForm.lawyerName && (
            <p className="text-brand-600 font-medium mt-1">{officeForm.lawyerName}</p>
          )}
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-brand-900 p-6 sm:p-8 text-white">
            <h2 className="text-xl font-bold mb-2">Solicitar contato</h2>
            <p className="text-brand-100/80 text-sm">Preencha apenas as informações necessárias para o atendimento inicial.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            <input 
              type="text" 
              name="company" 
              value={formData.company} 
              onChange={e => setFormData({...formData, company: e.target.value})} 
              className="hidden" 
              tabIndex={-1} 
              autoComplete="off" 
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome Completo *</label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Seu nome" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp *</label>
                <Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="seu@email.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Cidade *</label>
                <Input required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Sua cidade" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">UF *</label>
                <Input required value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} maxLength={2} placeholder="SP" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Área Jurídica *</label>
              <Select required value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})}>
                <option value="">Selecione a área</option>
                {officeForm.areas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
                <option value="Outro">Outro / Não sei</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Resumo Inicial *</label>
              <textarea 
                required
                rows={4}
                value={formData.summary}
                onChange={e => setFormData({...formData, summary: e.target.value})}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Descreva brevemente o motivo do contato..."
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-start gap-3">
              <input 
                type="checkbox" 
                required
                id="lgpd"
                checked={formData.consentLgpd}
                onChange={e => setFormData({...formData, consentLgpd: e.target.checked})}
                className="mt-1 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="lgpd" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                Autorizo o envio dos meus dados para que o escritório possa realizar o atendimento inicial. Não envie documentos ou informações sensíveis neste formulário.
              </label>
            </div>

            <Button type="submit" disabled={submitting || !formData.consentLgpd} className="w-full bg-brand-700 hover:bg-brand-800 h-12 text-base shadow-sm">
              {submitting ? 'Enviando...' : 'Enviar contato'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
