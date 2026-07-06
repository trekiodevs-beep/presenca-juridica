import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getPublicFormBySlug } from '../services/db';
import { PublicForm as PublicFormType } from '../types';
import { Building2, ShieldAlert } from 'lucide-react';
import { PublicContactForm } from '../components/PublicContactForm';

export const PublicForm = () => {
  const { officeSlug } = useParams<{ officeSlug: string }>();
  const [searchParams] = useSearchParams();
  
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
          setError('Formulário indisponível no momento.');
        }
      } catch (err) {
        setError('Ocorreu um erro ao carregar o formulário.');
      } finally {
        setLoading(false);
      }
    };
    loadForm();
  }, [officeSlug]);

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
          <p className="text-slate-500">{error || 'Formulário não encontrado.'}</p>
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

        <PublicContactForm officeForm={officeForm} officeSlug={officeSlug} />
      </div>
    </div>
  );
};

