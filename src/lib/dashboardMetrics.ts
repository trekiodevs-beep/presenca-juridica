import { Lead, LeadEvent } from '../types';
import { subDays, subMonths, isAfter, parseISO, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';

export type DashboardPeriod = 'today' | '7days' | '30days' | 'thisMonth' | 'all';

export const filterContactsByPeriod = (leads: Lead[], period: DashboardPeriod): Lead[] => {
  if (period === 'all') return leads;

  const now = new Date();
  let startDate: Date;

  if (period === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === '7days') {
    startDate = subDays(now, 7);
  } else if (period === '30days') {
    startDate = subDays(now, 30);
  } else if (period === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    startDate = subDays(now, 30);
  }

  return leads.filter(lead => isAfter(parseISO(lead.createdAt), startDate));
};

export const filterEventsByPeriod = (events: LeadEvent[], period: DashboardPeriod): LeadEvent[] => {
  if (period === 'all') return events;

  const now = new Date();
  let startDate: Date;

  if (period === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === '7days') {
    startDate = subDays(now, 7);
  } else if (period === '30days') {
    startDate = subDays(now, 30);
  } else if (period === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    startDate = subDays(now, 30);
  }

  return events.filter(event => isAfter(parseISO(event.createdAt), startDate));
};

export const getTriagePendingCount = (leads: Lead[]): number => {
  return leads.filter(l => l.status === 'Novo contato' || l.status === 'Aguardando triagem').length;
};

export const getOverdueActions = (leads: Lead[]): number => {
  const now = new Date();
  return leads.filter(l => 
    l.nextActionAt && 
    isAfter(now, parseISO(l.nextActionAt)) &&
    !['Arquivado', 'Contratado', 'Não avançou'].includes(l.status)
  ).length;
};

export const getUnassignedContacts = (leads: Lead[]): number => {
  return leads.filter(l => !l.responsibleUserId && !['Arquivado', 'Não avançou'].includes(l.status)).length;
};

export const getFirstResponseTime = (leads: Lead[], events: LeadEvent[]): number | null => {
  let totalMinutes = 0;
  let count = 0;

  leads.forEach(lead => {
    let firstResponseDate: Date | null = null;
    
    if (lead.lastWhatsappClickAt) {
      firstResponseDate = parseISO(lead.lastWhatsappClickAt);
    }
    
    const leadEvents = events.filter(e => e.leadId === lead.id && ['whatsapp_opened', 'note_added', 'status_changed'].includes(e.type));
    leadEvents.forEach(e => {
      const eventDate = parseISO(e.createdAt);
      if (!firstResponseDate || eventDate < firstResponseDate) {
        firstResponseDate = eventDate;
      }
    });

    if (firstResponseDate) {
      const created = parseISO(lead.createdAt);
      const diff = differenceInMinutes(firstResponseDate, created);
      if (diff >= 0) { // Safety check against weird data
        totalMinutes += diff;
        count++;
      }
    }
  });

  if (count === 0) return null;
  return Math.round(totalMinutes / count); // in minutes
};

export const formatTimeMinutes = (minutes: number | null): string => {
  if (minutes === null) return 'Sem dados';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
};

export const getReturnStartedRate = (leads: Lead[], events: LeadEvent[]): number => {
  if (leads.length === 0) return 0;
  
  let startedCount = 0;
  leads.forEach(lead => {
    if (lead.lastWhatsappClickAt) {
      startedCount++;
      return;
    }
    const hasEvent = events.some(e => e.leadId === lead.id && ['whatsapp_opened', 'note_added'].includes(e.type));
    if (hasEvent) {
      startedCount++;
    }
  });

  return Math.round((startedCount / leads.length) * 100);
};

export const groupBySource = (leads: Lead[]) => {
  const result: Record<string, { total: number; triagePending: number; scheduled: number; contracted: number; noReturn: number }> = {};
  
  leads.forEach(l => {
    const source = l.source || 'Sem origem';
    if (!result[source]) {
      result[source] = { total: 0, triagePending: 0, scheduled: 0, contracted: 0, noReturn: 0 };
    }
    result[source].total++;
    
    if (['Novo contato', 'Aguardando triagem'].includes(l.status)) {
      result[source].triagePending++;
    }
    if (l.status === 'Consulta agendada') {
      result[source].scheduled++;
    }
    if (l.status === 'Contratado') {
      result[source].contracted++;
    }
    
    // Simplification for 'noReturn' purely based on lastWhatsappClickAt for group speed. 
    // It's an approximation.
    if (!l.lastWhatsappClickAt) {
       result[source].noReturn++;
    }
  });
  
  return Object.entries(result).map(([name, stats]) => ({
    name,
    ...stats
  })).sort((a, b) => b.total - a.total);
};

export const groupByArea = (leads: Lead[]) => {
  const result: Record<string, { total: number; triagePending: number; scheduled: number }> = {};
  
  leads.forEach(l => {
    const area = l.area || 'Sem área';
    if (!result[area]) {
      result[area] = { total: 0, triagePending: 0, scheduled: 0 };
    }
    result[area].total++;
    
    if (['Novo contato', 'Aguardando triagem'].includes(l.status)) {
      result[area].triagePending++;
    }
    if (l.status === 'Consulta agendada') {
      result[area].scheduled++;
    }
  });
  
  return Object.entries(result).map(([name, stats]) => ({
    name,
    ...stats
  })).sort((a, b) => b.total - a.total);
};

export const groupByUtm = (leads: Lead[]) => {
  const result: Record<string, number> = {};
  leads.forEach(l => {
    if (l.utmSource) {
      const campaign = l.utmCampaign ? ` / ${l.utmCampaign}` : '';
      const key = `${l.utmSource}${campaign}`;
      result[key] = (result[key] || 0) + 1;
    }
  });
  return Object.entries(result).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
};

export const groupByStatus = (leads: Lead[]) => {
  const result: Record<string, number> = {};
  leads.forEach(l => {
    const status = l.status || 'Não informado';
    result[status] = (result[status] || 0) + 1;
  });
  return Object.entries(result).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

export const getAttentionItems = (leads: Lead[], events: LeadEvent[]) => {
  const now = new Date();
  const items: Array<{ lead: Lead; reason: string; priority: number }> = [];

  leads.forEach(lead => {
    if (['Contratado', 'Arquivado', 'Não avançou'].includes(lead.status)) return;

    // Overdue action
    if (lead.nextActionAt && isAfter(now, parseISO(lead.nextActionAt))) {
      items.push({ lead, reason: 'Providência vencida', priority: 100 });
      return;
    }

    // Unassigned
    if (!lead.responsibleUserId) {
      items.push({ lead, reason: 'Sem responsável definido', priority: 90 });
      return;
    }

    // Created > 24h without first return
    const createdDate = parseISO(lead.createdAt);
    const hoursSinceCreation = differenceInHours(now, createdDate);
    
    let hasReturn = !!lead.lastWhatsappClickAt;
    if (!hasReturn) {
      hasReturn = events.some(e => e.leadId === lead.id && ['whatsapp_opened', 'note_added'].includes(e.type));
    }
    
    if (!hasReturn && hoursSinceCreation > 24) {
      items.push({ lead, reason: 'Sem primeiro retorno há mais de 24h', priority: 80 });
      return;
    }

    // Novo contato > 24h
    if (lead.status === 'Novo contato' && hoursSinceCreation > 24) {
      items.push({ lead, reason: 'Aguardando triagem há mais de 24h', priority: 70 });
      return;
    }

    // Aguardando informações > 3 days
    if (lead.status === 'Aguardando informações') {
      // Find when it changed to this status
      const statusEvent = events.slice().reverse().find(e => e.leadId === lead.id && e.type === 'status_changed' && e.description.includes('Aguardando informações'));
      const sinceDate = statusEvent ? parseISO(statusEvent.createdAt) : createdDate;
      if (differenceInDays(now, sinceDate) > 3) {
        items.push({ lead, reason: 'Aguardando informações há mais de 3 dias', priority: 60 });
        return;
      }
    }

    // Proposta enviada > 7 days
    if (lead.status === 'Proposta enviada') {
      const statusEvent = events.slice().reverse().find(e => e.leadId === lead.id && e.type === 'status_changed' && e.description.includes('Proposta enviada'));
      const sinceDate = statusEvent ? parseISO(statusEvent.createdAt) : createdDate;
      if (differenceInDays(now, sinceDate) > 7) {
        items.push({ lead, reason: 'Proposta de honorários sem acompanhamento há mais de 7 dias', priority: 50 });
        return;
      }
    }
  });

  return items.sort((a, b) => b.priority - a.priority).slice(0, 6);
};

export const getTimelineSeries = (leads: Lead[], period: DashboardPeriod) => {
  const result: Record<string, number> = {};
  
  leads.forEach(l => {
    const date = parseISO(l.createdAt);
    let key = '';
    
    if (period === 'today') {
      key = `${date.getHours().toString().padStart(2, '0')}:00`;
    } else if (period === 'all') {
      key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    } else {
      key = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    
    result[key] = (result[key] || 0) + 1;
  });

  // Sort keys properly based on the format
  return Object.entries(result)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([name, value]) => ({ name, value }));
};
