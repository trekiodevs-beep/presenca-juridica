import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const cleanPhone = (phone?: string | null) => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

export const formatPhoneForWhatsapp = (phone?: string | null) => {
  const cleaned = cleanPhone(phone);
  if (!cleaned) return '';
  if (cleaned.startsWith('55')) {
    return cleaned;
  }
  return `55${cleaned}`;
};

export const formatPhoneForDisplay = (phone?: string | null) => {
  if (!phone) return '';
  const cleaned = cleanPhone(phone);
  // Optional: remove 55 if it's there for local display
  let localNum = cleaned;
  if (localNum.startsWith('55') && localNum.length > 11) {
    localNum = localNum.substring(2);
  }
  
  if (localNum.length === 11) {
    return `(${localNum.substring(0, 2)}) ${localNum.substring(2, 7)}-${localNum.substring(7, 11)}`;
  } else if (localNum.length === 10) {
    return `(${localNum.substring(0, 2)}) ${localNum.substring(2, 6)}-${localNum.substring(6, 10)}`;
  }
  return phone;
};

export const humanizeSource = (source?: string | null): string => {
  if (!source) return 'por outro canal';
  const lower = source.trim().toLowerCase();
  switch (lower) {
    case 'whatsapp':
      return 'pelo WhatsApp';
    case 'instagram':
      return 'pelo Instagram';
    case 'site':
      return 'pelo site';
    case 'landing page':
      return 'pela landing page';
    case 'indicação':
    case 'indicacao':
      return 'por indicação';
    case 'cadastro manual':
      return 'por cadastro manual';
    default:
      return 'por outro canal';
  }
};

export const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
  } catch (e) {
    return dateStr || '';
  }
};

export const formatDateOnly = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch (e) {
    return dateStr || '';
  }
};

