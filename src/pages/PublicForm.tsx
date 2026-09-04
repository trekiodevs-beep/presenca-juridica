import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, ShieldAlert } from 'lucide-react';

import { PublicContactForm } from '../components/PublicContactForm';
import { getPublicFormBySlug } from '../services/db';
import { PublicForm as PublicFormType } from '../types';

export const PublicForm = () => {
  const { officeSlug } = useParams<{ officeSlug: string }>();

  const [loading, setLoading] = useState(true);
  const [officeForm, setOfficeForm] = useState<PublicFormType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedOfficeSlug = officeSlug?.trim() ?? '';

  useEffect(() => {
    let cancelled = false;

    const loadForm = async () => {
      setLoading(true);
      setOfficeForm(null);
      setError(null);

      if (!normalizedOfficeSlug) {
        if (!cancelled) {
          setError('Formulário indisponível no momento.');
          setLoading(false);
        }

        return;
      }

      try {
        const form = await getPublicFormBySlug(normalizedOfficeSlug);

        if (cancelled) {
          return;
        }

        if (!form || form.isActive !== true) {
          setError('Formulário indisponível no momento.');
          return;
        }

        setOfficeForm(form);
      } catch (err) {
        console.error('Error fetching public form:', err);
        if (!cancelled) {
          /*
           * A mesma mensagem é usada para documento inexistente,
           * formulário inativo e acesso negado. Isso evita revelar
           * publicamente o estado interno do formulário.
           */
          setError('Formulário indisponível no momento.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadForm();

    return () => {
      cancelled = true;
    };
  }, [normalizedOfficeSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"
          role="status"
          aria-label="Carregando formulário"
        />
      </div>
    );
  }

  if (error || !officeForm || !normalizedOfficeSlug) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <ShieldAlert
            className="w-12 h-12 text-slate-300 mx-auto mb-4"
            aria-hidden="true"
          />

          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Formulário indisponível
          </h1>

          <p className="text-slate-500">
            {error ?? 'Não foi possível acessar este formulário no momento.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <header className="text-center mb-8">
          <div className="mx-auto bg-brand-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-brand-700">
            <Building2
              className="w-8 h-8"
              aria-hidden="true"
            />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {officeForm.officeName}
          </h1>

          {officeForm.lawyerName && (
            <p className="text-brand-600 font-medium mt-1">
              {officeForm.lawyerName}
            </p>
          )}
        </header>

        <PublicContactForm
          officeForm={officeForm}
          officeSlug={normalizedOfficeSlug}
        />
      </div>
    </div>
  );
};