import { Lead, Office, User, LeadEvent } from './types';

export const mockUser: User = {
  id: 'u1',
  name: 'Dr. João Silva',
  email: 'joao@silvaadvogados.com.br',
  role: 'admin',
  officeId: 'o1',
  createdAt: new Date().toISOString(),
};

export const mockOffice: Office = {
  id: 'o1',
  name: 'Silva & Advogados Associados',
  lawyerName: 'João Silva',
  oab: 'OAB/SP 123456',
  city: 'São Paulo',
  state: 'SP',
  whatsapp: '11999999999',
  email: 'contato@silvaadvogados.com.br',
  areas: ['Direito Trabalhista', 'Direito de Família', 'Direito do Consumidor'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

export const mockLeads: Lead[] = [
  {
    id: 'l1',
    officeId: 'o1',
    name: 'Maria Oliveira',
    phone: '11988887777',
    email: 'maria.oliveira@email.com',
    city: 'São Paulo',
    state: 'SP',
    source: 'WhatsApp',
    area: 'Direito Trabalhista',
    status: 'Novo contato',
    priority: 'Alta',
    responsibleUserId: 'u1',
    summary: 'Demitida sem justa causa, empresa não pagou rescisão.',
    notes: 'Cliente muito preocupada com os prazos.',
    consentLgpd: true,
    nextActionText: 'Ligar para entender os detalhes do contrato de trabalho',
    nextActionAt: today.toISOString(),
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: 'l2',
    officeId: 'o1',
    name: 'Carlos Mendes',
    phone: '11977776666',
    email: 'carlos.mendes@email.com',
    city: 'Campinas',
    state: 'SP',
    source: 'Landing Page',
    area: 'Direito de Família',
    status: 'Aguardando triagem',
    priority: 'Média',
    summary: 'Dúvidas sobre pensão alimentícia.',
    notes: '',
    consentLgpd: true,
    createdAt: yesterday.toISOString(),
    updatedAt: yesterday.toISOString(),
  },
  {
    id: 'l3',
    officeId: 'o1',
    name: 'Fernanda Costa',
    phone: '11966665555',
    email: 'fernanda@email.com',
    city: 'São Paulo',
    state: 'SP',
    source: 'Instagram',
    area: 'Direito do Consumidor',
    status: 'Consulta agendada',
    priority: 'Baixa',
    responsibleUserId: 'u1',
    summary: 'Voo cancelado, perdeu compromisso de trabalho.',
    notes: 'Já enviou os bilhetes por e-mail.',
    consentLgpd: true,
    nextActionText: 'Realizar consulta online',
    nextActionAt: tomorrow.toISOString(),
    createdAt: yesterday.toISOString(),
    updatedAt: today.toISOString(),
  }
];

export const mockEvents: LeadEvent[] = [
  {
    id: 'e1',
    officeId: 'o1',
    leadId: 'l1',
    type: 'created',
    description: 'Lead criado no sistema',
    createdBy: 'Sistema',
    createdAt: today.toISOString(),
  },
  {
    id: 'e2',
    officeId: 'o1',
    leadId: 'l3',
    type: 'status_changed',
    description: 'Status alterado para "Consulta agendada"',
    createdBy: 'u1',
    createdAt: today.toISOString(),
  }
];
