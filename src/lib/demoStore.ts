import { mockLeads, mockEvents, mockTasks, mockDocuments, mockCalendarEvents, mockFinancialRecords, mockPortalAccesses, mockOffice } from '../mockData';
import type { ClientPortalAccess, Lead, PublicForm } from '../types';

export const DEMO_STORAGE_KEY = 'presenca-juridica-demo-v1';
export const DEMO_CHANGED = 'presenca-juridica-demo-changed';
const names = ['Ana Ribeiro', 'Pedro Almeida', 'Juliana Santos', 'Rafael Lima', 'Beatriz Rocha', 'Lucas Ferreira', 'Camila Martins', 'Bruno Azevedo', 'Mariana Duarte', 'Felipe Nunes', 'Clara Batista', 'André Moreira'];
const statuses: Lead['status'][] = ['Novo contato', 'Aguardando triagem', 'Triagem realizada', 'Aguardando informações', 'Consulta agendada', 'Proposta enviada', 'Contratado'];
const additionalLeads: Lead[] = names.map((name, index) => ({
  id: `demo-${index}`, officeId: mockOffice.id, name, phone: '11000000000', email: `contato${index}@example.com`, city: 'São Paulo', state: 'SP',
  source: index % 2 ? 'Site' : 'Indicação', area: mockOffice.areas[index % mockOffice.areas.length], status: statuses[index % statuses.length],
  priority: 'Média', responsibleUserId: 'u1', summary: 'Solicitação fictícia de atendimento inicial para demonstração.', notes: '', consentLgpd: true,
  nextActionText: 'Confirmar disponibilidade para o atendimento', nextActionAt: new Date(Date.now() + (index % 3) * 86400000).toISOString(),
  createdAt: new Date(Date.now() - (index + 1) * 86400000).toISOString(), updatedAt: new Date().toISOString(),
}));
const initialDemo = () => ({ leads: [...mockLeads, ...additionalLeads], events: mockEvents, tasks: mockTasks, documents: mockDocuments, calendarEvents: mockCalendarEvents, financialRecords: mockFinancialRecords, portalAccesses: mockPortalAccesses });
export type DemoData = ReturnType<typeof initialDemo>;

export function readDemoData(): DemoData {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Object.keys(initialDemo()).every(key => Array.isArray(parsed[key]))) return parsed as DemoData;
    }
  } catch { /* An absent or invalid demo snapshot starts with fictitious seed data. */ }
  return initialDemo();
}

export function saveDemoData(data: DemoData) {
  const serialized = JSON.stringify(data);
  if (localStorage.getItem(DEMO_STORAGE_KEY) !== serialized) localStorage.setItem(DEMO_STORAGE_KEY, serialized);
}

export function createDemoPublicLead(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) {
  if (input.publicFormSlug !== mockOffice.slug || !input.consentLgpd || !input.name.trim()) throw new Error('Formulário demonstrativo inválido.');
  const data = readDemoData();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  data.leads.unshift({ ...input, id, officeId: mockOffice.id, notes: '', status: 'Novo contato', responsibleUserId: input.responsibleUserId || 'u1', createdAt: now, updatedAt: now });
  data.events.unshift({ id: crypto.randomUUID(), officeId: mockOffice.id, leadId: id, type: 'created', description: 'Contato recebido pelo formulário público (demonstração)', createdBy: 'public_form', createdAt: now });
  saveDemoData(data);
  window.dispatchEvent(new Event(DEMO_CHANGED));
  return id;
}

export function getDemoPublicForm(slug: string): PublicForm | null {
  if (slug !== mockOffice.slug) return null;
  return { slug, officeId: mockOffice.id, officeName: mockOffice.name, lawyerName: mockOffice.lawyerName, whatsapp: mockOffice.whatsapp, email: mockOffice.email, city: mockOffice.city, state: mockOffice.state, areas: mockOffice.areas, isActive: true, createdAt: mockOffice.createdAt, updatedAt: mockOffice.updatedAt };
}

export function getDemoPortalAccessByToken(token: string): ClientPortalAccess | null {
  return readDemoData().portalAccesses.find(access => access.id === token) || null;
}
