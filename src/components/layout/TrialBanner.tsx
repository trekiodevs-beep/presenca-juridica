import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, CreditCard } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { getTrialState, TRIAL_DAYS } from '../../lib/trial';
import { cn } from '../../lib/utils';

export const TrialBanner = () => {
  const { office } = useAuth();
  const trialState = getTrialState(office);

  if (!trialState || trialState.kind === 'active') return null;

  const isExpired = trialState.kind === 'expired';
  const isNotConfigured = trialState.kind === 'not_configured';
  const Icon = isExpired ? AlertTriangle : isNotConfigured ? CreditCard : Clock;

  return (
    <div
      className={cn(
        'border-b px-4 py-2 sm:px-6 lg:px-8',
        isExpired
          ? 'border-red-200 bg-red-50 text-red-900'
          : isNotConfigured
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-brand-200 bg-brand-50 text-brand-900'
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {isExpired
                ? `Seu teste de ${TRIAL_DAYS} dias expirou.`
                : isNotConfigured
                  ? `Configure o teste comercial de ${TRIAL_DAYS} dias para este escritório.`
                  : `Teste grátis ativo: ${trialState.label}.`}
            </p>
            <p className="text-xs opacity-80">
              {isExpired
                ? 'O acesso ainda está liberado nesta fase piloto, mas este escritório precisa virar plano pago para operação comercial.'
                : 'Use este período para validar captação, triagem, retorno pelo WhatsApp e rotina de atendimento.'}
            </p>
          </div>
        </div>

        <Link
          to="/settings"
          className={cn(
            'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors',
            isExpired
              ? 'border-red-300 bg-white text-red-700 hover:bg-red-100'
              : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-100'
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Ver plano
        </Link>
      </div>
    </div>
  );
};
