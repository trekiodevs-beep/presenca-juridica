import React from 'react';
import { cn } from '../../lib/utils';
import { LeadStatus, Priority } from '../../types';
import { getStatusLabel } from '../../lib/legalTerminology';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export const Badge = ({ className, variant = 'default', ...props }: BadgeProps) => {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          'bg-brand-100 text-brand-800': variant === 'default',
          'bg-green-100 text-green-800': variant === 'success',
          'bg-amber-100 text-amber-800': variant === 'warning',
          'bg-red-100 text-red-800': variant === 'error',
          'bg-slate-100 text-slate-800': variant === 'neutral',
        },
        className
      )}
      {...props}
    />
  );
};

export const StatusBadge = ({ status }: { status: LeadStatus }) => {
  let variant: BadgeProps['variant'] = 'default';
  
  if (status === 'Contratado') variant = 'success';
  if (status === 'Não avançou' || status === 'Arquivado') variant = 'neutral';
  if (status === 'Novo contato') variant = 'error';
  if (status === 'Aguardando triagem' || status === 'Aguardando informações') variant = 'warning';

  return <Badge variant={variant}>{getStatusLabel(status)}</Badge>;
}

export const PriorityBadge = ({ priority }: { priority: Priority }) => {
  let variant: BadgeProps['variant'] = 'default';
  
  if (priority === 'Alta') variant = 'error';
  if (priority === 'Média') variant = 'warning';
  if (priority === 'Baixa') variant = 'success';

  return <Badge variant={variant}>{priority}</Badge>;
}
