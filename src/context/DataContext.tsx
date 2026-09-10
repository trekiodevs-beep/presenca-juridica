import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CalendarEvent, ClientPortalAccess, DocumentCategory, FinancialRecord, Lead, LeadDocument, LeadEvent, Task } from '../types';
import { useAuth } from './AuthContext';
import {
  listenLeadsByOffice,
  listenEventsByOffice,
  listenTasksByOffice,
  listenDocumentsByOffice,
  listenCalendarEventsByOffice,
  listenFinancialRecordsByOffice,
  listenClientPortalAccessByOffice,
  createLead,
  updateLead as dbUpdateLead,
  addLeadEvent as dbAddLeadEvent,
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  uploadLeadDocument as dbUploadLeadDocument,
  createCalendarEvent as dbCreateCalendarEvent,
  updateCalendarEvent as dbUpdateCalendarEvent,
  deleteCalendarEvent as dbDeleteCalendarEvent,
  createFinancialRecord as dbCreateFinancialRecord,
  updateFinancialRecord as dbUpdateFinancialRecord,
  upsertClientPortalAccess as dbUpsertClientPortalAccess,
} from '../services/supabaseDb';
import { canWriteOffice } from '../lib/access';
import { hasPermission } from '../lib/plans';
import type { Permission } from '../types';
import { readDemoData, saveDemoData, DEMO_CHANGED, DEMO_STORAGE_KEY } from '../lib/demoStore';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

interface DataContextType {
  leads: Lead[];
  events: LeadEvent[];
  tasks: Task[];
  documents: LeadDocument[];
  calendarEvents: CalendarEvent[];
  financialRecords: FinancialRecord[];
  portalAccesses: ClientPortalAccess[];
  loading: boolean;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'officeId'>) => Promise<string | undefined>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  addEvent: (event: Omit<LeadEvent, 'id' | 'createdAt' | 'officeId'>) => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'officeId'>) => Promise<string | undefined>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  uploadLeadDocument: (leadId: string, file: File, category: DocumentCategory, visibleInPortal: boolean) => Promise<string | undefined>;
  addCalendarEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'officeId'>) => Promise<string | undefined>;
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;
  addFinancialRecord: (record: Omit<FinancialRecord, 'id' | 'createdAt' | 'updatedAt' | 'officeId'>) => Promise<string | undefined>;
  updateFinancialRecord: (id: string, updates: Partial<FinancialRecord>) => Promise<void>;
  upsertPortalAccess: (access: Omit<ClientPortalAccess, 'id' | 'createdAt' | 'updatedAt' | 'officeId'> & { id?: string }) => Promise<string | undefined>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { user, office } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<LeadDocument[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [portalAccesses, setPortalAccesses] = useState<ClientPortalAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoReady, setDemoReady] = useState(false);

  useEffect(() => {
    if (USE_MOCK && demoReady) saveDemoData({ leads, events, tasks, documents, calendarEvents, financialRecords, portalAccesses });
  }, [demoReady, leads, events, tasks, documents, calendarEvents, financialRecords, portalAccesses]);

  const requirePermission = (permission: Permission) => {
    if (!office?.id) throw new Error('Nenhum escritório selecionado.');
    if (!canWriteOffice(office)) {
      throw new Error('O período de acesso permite apenas leitura. Consulte Plano e cobrança para reativar o escritório.');
    }
    if (!hasPermission(user?.role, permission)) {
      throw new Error('Seu perfil não possui permissão para esta operação.');
    }
  };

  // Load data based on auth state
  useEffect(() => {
    if (USE_MOCK) {
      const refresh = () => {
        const data = readDemoData();
        setLeads(data.leads); setEvents(data.events); setTasks(data.tasks);
        setDocuments(data.documents); setCalendarEvents(data.calendarEvents);
        setFinancialRecords(data.financialRecords); setPortalAccesses(data.portalAccesses);
        setDemoReady(true);
      };
      refresh();
      const storageChanged = (event: StorageEvent) => { if (event.key === DEMO_STORAGE_KEY) refresh(); };
      window.addEventListener(DEMO_CHANGED, refresh);
      window.addEventListener('storage', storageChanged);
      setLoading(false);
      return () => { window.removeEventListener(DEMO_CHANGED, refresh); window.removeEventListener('storage', storageChanged); };
    }
    
    if (!office?.id) {
      setLeads([]);
      setEvents([]);
      setTasks([]);
      setDocuments([]);
      setCalendarEvents([]);
      setFinancialRecords([]);
      setPortalAccesses([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubLeads = listenLeadsByOffice(office.id, (fetchedLeads) => {
      setLeads(fetchedLeads);
      setLoading(false);
    });
    
    const unsubEvents = listenEventsByOffice(office.id, (fetchedEvents) => {
      setEvents(fetchedEvents);
    });

    const unsubTasks = listenTasksByOffice(office.id, (fetchedTasks) => {
      setTasks(fetchedTasks);
    });

    const unsubDocuments = listenDocumentsByOffice(office.id, (fetchedDocuments) => {
      setDocuments(fetchedDocuments);
    });

    const unsubCalendarEvents = listenCalendarEventsByOffice(office.id, (fetchedCalendarEvents) => {
      setCalendarEvents(fetchedCalendarEvents);
    });

    const unsubFinancialRecords = listenFinancialRecordsByOffice(office.id, (fetchedFinancialRecords) => {
      setFinancialRecords(fetchedFinancialRecords);
    });

    const unsubPortalAccesses = listenClientPortalAccessByOffice(office.id, (fetchedPortalAccesses) => {
      setPortalAccesses(fetchedPortalAccesses);
    });
    
    return () => {
      unsubLeads();
      unsubEvents();
      unsubTasks();
      unsubDocuments();
      unsubCalendarEvents();
      unsubFinancialRecords();
      unsubPortalAccesses();
    };
  }, [office?.id]);

  const addLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'officeId'>) => {
    if (!office?.id) return;
    requirePermission('contacts.write');
    
    if (USE_MOCK) {
      const leadId = `l${Date.now()}`;
      const newLead: Lead = {
        ...leadData,
        id: leadId,
        officeId: 'o1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLeads([newLead, ...leads]);
      
      addEvent({
        leadId: newLead.id,
        type: 'created',
        description: 'Contato criado via sistema',
        createdBy: user?.id || 'u1'
      });
      return leadId;
    }
    
    return createLead({
      ...leadData,
      officeId: office.id,
      responsibleUserId: leadData.responsibleUserId || user?.id || undefined
    });
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    requirePermission('contacts.write');
    if (USE_MOCK) {
      setLeads(leads.map(lead => 
        lead.id === id 
          ? { ...lead, ...updates, updatedAt: new Date().toISOString() } 
          : lead
      ));
      return;
    }
    
    await dbUpdateLead(id, updates, user?.id || '');
  };

  const addEvent = async (eventData: Omit<LeadEvent, 'id' | 'createdAt' | 'officeId'>) => {
    if (!office?.id) return;
    requirePermission('contacts.write');
    
    if (USE_MOCK) {
      const newEvent: LeadEvent = {
        ...eventData,
        id: `e${Date.now()}`,
        officeId: 'o1',
        createdAt: new Date().toISOString(),
      };
      setEvents([newEvent, ...events]);
      return;
    }
    
    await dbAddLeadEvent({
      ...eventData,
      officeId: office.id
    });
  };

  const addTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'officeId'>) => {
    if (!office?.id) return;
    requirePermission('tasks.write');

    if (USE_MOCK) {
      const now = new Date().toISOString();
      const taskId = `task${Date.now()}`;
      const newTask: Task = {
        ...taskData,
        responsibleUserId: taskData.responsibleUserId || user?.id || null,
        createdBy: taskData.createdBy || user?.id || null,
        id: taskId,
        officeId: 'o1',
        createdAt: now,
      };
      setTasks([...tasks, newTask].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()));
      if (taskData.leadId) {
        await addEvent({
          leadId: taskData.leadId,
          type: 'action_created',
          description: `Tarefa criada: ${taskData.title}`,
          createdBy: user?.id || 'Sistema',
        });
      }
      return taskId;
    }

    const taskId = await dbCreateTask({
      ...taskData,
      responsibleUserId: taskData.responsibleUserId || user?.id || null,
      createdBy: taskData.createdBy || user?.id || null,
      officeId: office.id,
    });
    if (taskData.leadId) {
      await addEvent({
        leadId: taskData.leadId,
        type: 'action_created',
        description: `Tarefa criada: ${taskData.title}`,
        createdBy: user?.id || 'Sistema',
      });
    }
    return taskId;
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    requirePermission('tasks.write');
    if (USE_MOCK) {
      setTasks(tasks.map(task => task.id === id ? { ...task, ...updates } : task));
      return;
    }

    await dbUpdateTask(id, updates);
  };

  const uploadLeadDocument = async (leadId: string, file: File, category: DocumentCategory, visibleInPortal: boolean) => {
    if (!office?.id) return;
    requirePermission('documents.write');

    if (USE_MOCK) {
      const now = new Date().toISOString();
      const documentId = `d${Date.now()}`;
      const newDocument: LeadDocument = {
        id: documentId,
        officeId: 'o1',
        leadId,
        name: file.name,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        storagePath: `mock/${file.name}`,
        downloadUrl: '#',
        category,
        visibleInPortal,
        uploadedBy: user?.id || 'u1',
        createdAt: now,
        updatedAt: now,
      };
      setDocuments([newDocument, ...documents]);
      await addEvent({
        leadId,
        type: 'document_uploaded',
        description: `Documento anexado: ${file.name}`,
        createdBy: user?.id || 'Sistema',
      });
      return documentId;
    }

    const documentId = await dbUploadLeadDocument({
      officeId: office.id,
      leadId,
      file,
      category,
      visibleInPortal,
      uploadedBy: user?.id || 'Sistema',
    });
    await addEvent({
      leadId,
      type: 'document_uploaded',
      description: `Documento anexado: ${file.name}`,
      createdBy: user?.id || 'Sistema',
    });
    return documentId;
  };

  const addCalendarEvent = async (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'officeId'>) => {
    if (!office?.id) return;
    requirePermission('calendar.write');

    if (USE_MOCK) {
      const now = new Date().toISOString();
      const eventId = `cal${Date.now()}`;
      const newEvent: CalendarEvent = {
        ...eventData,
        id: eventId,
        officeId: 'o1',
        createdAt: now,
        updatedAt: now,
      };
      setCalendarEvents([...calendarEvents, newEvent].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
      if (eventData.leadId) {
        await addEvent({
          leadId: eventData.leadId,
          type: 'calendar_event_created',
          description: `Agenda criada: ${eventData.title}`,
          createdBy: user?.id || 'Sistema',
        });
      }
      return eventId;
    }

    const eventId = await dbCreateCalendarEvent({
      ...eventData,
      officeId: office.id,
      responsibleUserId: eventData.responsibleUserId || user?.id || null,
    });
    if (eventData.leadId) {
      await addEvent({
        leadId: eventData.leadId,
        type: 'calendar_event_created',
        description: `Agenda criada: ${eventData.title}`,
        createdBy: user?.id || 'Sistema',
      });
    }
    return eventId;
  };

  const updateCalendarEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    requirePermission('calendar.write');
    if (USE_MOCK) {
      setCalendarEvents(calendarEvents.map(event => event.id === id ? { ...event, ...updates, updatedAt: new Date().toISOString() } : event));
      return;
    }
    await dbUpdateCalendarEvent(id, updates);
  };

  const deleteCalendarEvent = async (id: string) => {
    requirePermission('calendar.write');
    if (USE_MOCK) {
      setCalendarEvents(calendarEvents.map(event => event.id === id ? { ...event, status: 'Cancelado', syncStatus: 'cancelled', deletedAt: new Date().toISOString() } : event));
      return;
    }
    await dbDeleteCalendarEvent(id);
  };

  const addFinancialRecord = async (recordData: Omit<FinancialRecord, 'id' | 'createdAt' | 'updatedAt' | 'officeId'>) => {
    if (!office?.id) return;
    requirePermission('finance.write');

    if (USE_MOCK) {
      const now = new Date().toISOString();
      const recordId = `fin${Date.now()}`;
      const newRecord: FinancialRecord = {
        ...recordData,
        id: recordId,
        officeId: 'o1',
        createdAt: now,
        updatedAt: now,
      };
      setFinancialRecords([newRecord, ...financialRecords]);
      if (recordData.leadId) {
        await addEvent({
          leadId: recordData.leadId,
          type: 'financial_record_created',
          description: `Lançamento financeiro criado: ${recordData.description}`,
          createdBy: user?.id || 'Sistema',
        });
      }
      return recordId;
    }

    const recordId = await dbCreateFinancialRecord({
      ...recordData,
      officeId: office.id,
    });
    if (recordData.leadId) {
      await addEvent({
        leadId: recordData.leadId,
        type: 'financial_record_created',
        description: `Lançamento financeiro criado: ${recordData.description}`,
        createdBy: user?.id || 'Sistema',
      });
    }
    return recordId;
  };

  const updateFinancialRecord = async (id: string, updates: Partial<FinancialRecord>) => {
    requirePermission('finance.write');
    if (USE_MOCK) {
      setFinancialRecords(financialRecords.map(record => record.id === id ? { ...record, ...updates, updatedAt: new Date().toISOString() } : record));
      return;
    }
    await dbUpdateFinancialRecord(id, updates);
  };

  const upsertPortalAccess = async (accessData: Omit<ClientPortalAccess, 'id' | 'createdAt' | 'updatedAt' | 'officeId'> & { id?: string }) => {
    if (!office?.id) return;
    requirePermission('portal.write');

    if (USE_MOCK) {
      const now = new Date().toISOString();
      const accessId = accessData.id || `portal${Date.now()}`;
      const existing = portalAccesses.find(access => access.id === accessId);
      const newAccess: ClientPortalAccess = {
        ...accessData,
        id: accessId,
        officeId: 'o1',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      setPortalAccesses([newAccess, ...portalAccesses.filter(access => access.id !== accessId)]);
      await addEvent({
        leadId: accessData.leadId,
        type: 'portal_updated',
        description: accessData.isActive ? 'Portal do cliente atualizado' : 'Portal do cliente desativado',
        createdBy: user?.id || 'Sistema',
      });
      return accessId;
    }

    const accessId = await dbUpsertClientPortalAccess({
      ...accessData,
      officeId: office.id,
    });
    const now = new Date().toISOString();
    const existing = portalAccesses.find(access => access.id === accessId);
    const savedAccess: ClientPortalAccess = {
      ...accessData,
      id: accessId,
      officeId: office.id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    setPortalAccesses(current => [savedAccess, ...current.filter(access => access.id !== accessId)]);
    await addEvent({
      leadId: accessData.leadId,
      type: 'portal_updated',
      description: accessData.isActive ? 'Portal do cliente atualizado' : 'Portal do cliente desativado',
      createdBy: user?.id || 'Sistema',
    });
    return accessId;
  };

  return (
    <DataContext.Provider value={{
      leads,
      events,
      tasks,
      documents,
      calendarEvents,
      financialRecords,
      portalAccesses,
      loading,
      addLead,
      updateLead,
      addEvent,
      addTask,
      updateTask,
      uploadLeadDocument,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      addFinancialRecord,
      updateFinancialRecord,
      upsertPortalAccess,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
