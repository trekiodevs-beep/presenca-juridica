import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, CreditCard } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { getTrialState, TRIAL_DAYS } from '../../lib/trial';
import { getAccessMode, subscriptionLabel } from '../../lib/access';
import { cn } from '../../lib/utils';

export const TrialBanner = () => {
  const { office } = useAuth();
  const trialState = getTrialState(office);

  const accessMode = getAccessMode(office);
  if (!trialState || trialState.kind === 'active' && accessMode === 'full') return null;

  const isExpired = trialState.kind === 'expired' || accessMode === 'read_only';
  const isNotConfigured = trialState.kind === 'not_configured';
  const isGrace = accessMode === 'grace';
  const Icon = isExpired ? AlertTriangle : isNotConfigured ? CreditCard : isGrace ? CreditCard : Clock;

  return (
    <div
      className={cn(
        'border-b px-4 py-1.5 sm:px-6 lg:px-8',
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
                ? office?.subscriptionStatus === 'TRIALING' || office?.subscriptionStatus === 'EXPIRED'
                  ? `Seu teste de ${TRIAL_DAYS} dias expirou.`
                  : 'O acesso do escritório está suspenso.'
                : isNotConfigured
                  ? `Configure o teste comercial de ${TRIAL_DAYS} dias para este escritório.`
                  : isGrace
                    ? 'Pagamento pendente: regularize sua assinatura.'
                    : `${trialState.label}.`}
            </p>
            <p className="text-xs opacity-80">
              {isExpired
                ? 'O escritório está em modo somente leitura. Regularize o plano para retomar novos contatos, tarefas e atualizações.'
                : accessMode === 'grace'
                  ? `Pagamento pendente: ${subscriptionLabel[office?.subscriptionStatus || 'PAST_DUE']}. O acesso completo será mantido durante a tolerância.`
                  : 'Explore o atendimento inicial, a triagem e o retorno pelo WhatsApp.'}
            </p>
          </div>
        </div>

        <Link
          to="/billing"
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
