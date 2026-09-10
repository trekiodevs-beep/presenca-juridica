import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicFormBySlug } from '../services/supabaseDb';
import { PublicForm as PublicFormType } from '../types';
import { Building2, MessageSquare, ShieldAlert, MapPin, Scale, ChevronRight, Info } from 'lucide-react';
import { PublicContactForm } from '../components/PublicContactForm';
import { formatPhoneForWhatsapp } from '../lib/utils';
import { Button } from '../components/ui/Button';

export const OfficePublicPage = () => {
  const { officeSlug } = useParams<{ officeSlug: string }>();
  
  const [loading, setLoading] = useState(true);
  const [officeForm, setOfficeForm] = useState<PublicFormType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadForm = async () => {
      if (!officeSlug) return;
      try {
        const form = await getPublicFormBySlug(officeSlug);
        if (form && form.isActive) {
          setOfficeForm(form);
        } else {
          setError('Página indisponível no momento.');
        }
      } catch (err) {
        setError('Ocorreu um erro ao carregar a página.');
      } finally {
        setLoading(false);
      }
    };
    loadForm();
  }, [officeSlug]);

  const handleWhatsapp = () => {
    if (officeForm?.whatsapp) {
      const formatted = formatPhoneForWhatsapp(officeForm.whatsapp);
      const text = encodeURIComponent("Olá! Gostaria de falar com o escritório.");
      window.open(`https://wa.me/${formatted}?text=${text}`, '_blank');
    }
  };

  const handleScrollToForm = () => {
    const element = document.getElementById('contact-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
      </div>
    );
  }

  if (error || !officeForm || !officeSlug) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Ops!</h2>
          <p className="text-slate-500">{error || 'Página não encontrada.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Area */}
        <header className="mb-10 text-center md:text-left md:flex md:items-center md:justify-between border-b border-slate-200 pb-8">
          <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
            <div className="bg-brand-900 w-16 h-16 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{officeForm.officeName}</h1>
              {officeForm.lawyerName && (
                <p className="text-brand-600 font-semibold text-lg">{officeForm.lawyerName}</p>
              )}
            </div>
          </div>
          
          {officeForm.whatsapp && (
            <div className="mt-6 md:mt-0 flex justify-center">
              <Button 
                onClick={handleWhatsapp} 
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2 px-6 h-12 rounded-xl shadow-sm transition-all"
              >
                <MessageSquare className="w-5 h-5" />
                Falar pelo WhatsApp
              </Button>
            </div>
          )}
        </header>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column - Presentation */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <Scale className="w-5 h-5 text-brand-600" />
                  Áreas de Atuação
                </h3>
                <p className="text-slate-500 text-sm mb-4">
                  Prestamos assessoria de excelência com foco nas seguintes especialidades jurídicas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {officeForm.areas.map(area => (
                    <span 
                      key={area} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 text-xs font-medium border border-slate-100"
                    >
                      <ChevronRight className="w-3 h-3 text-brand-500" />
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              {(officeForm.city || officeForm.state) && (
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    Localização
                  </h3>
                  <p className="text-slate-600 text-sm">
                    {officeForm.city && officeForm.city}
                    {officeForm.city && officeForm.state ? ` - ${officeForm.state}` : officeForm.state}
                  </p>
                </div>
              )}

              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <p className="text-slate-700 text-sm font-medium leading-relaxed">
                    Preencha o formulário para solicitar atendimento inicial.
                  </p>
                  <p className="text-slate-500 text-xs flex items-start gap-2 leading-relaxed">
                    <Info className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                    Informe apenas dados necessários para o atendimento inicial. Seus dados estão protegidos.
                  </p>
                </div>
                
                <Button 
                  onClick={handleScrollToForm} 
                  variant="outline" 
                  className="w-full h-11 border-brand-200 text-brand-700 hover:bg-brand-50 lg:hidden"
                >
                  Solicitar contato agora
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="lg:col-span-7">
            <PublicContactForm officeForm={officeForm} officeSlug={officeSlug} />
          </div>

        </div>

      </div>
    </div>
  );
};
