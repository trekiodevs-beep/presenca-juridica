import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Lead, LeadEvent, Task } from '../types';
import { mockLeads, mockEvents } from '../mockData';
import { useAuth } from './AuthContext';
import { listenLeadsByOffice, listenEventsByOffice, createLead, updateLead as dbUpdateLead, addLeadEvent as dbAddLeadEvent } from '../services/db';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

interface DataContextType {
  leads: Lead[];
  events: LeadEvent[];
  tasks: Task[];
  loading: boolean;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'officeId'>) => Promise<void>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  addEvent: (event: Omit<LeadEvent, 'id' | 'createdAt' | 'officeId'>) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { user, office } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data based on auth state
  useEffect(() => {
    if (USE_MOCK) {
      setLeads(mockLeads);
      setEvents(mockEvents);
      setLoading(false);
      return;
    }
    
    if (!office?.id) {
      setLeads([]);
      setEvents([]);
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
    
    return () => {
      unsubLeads();
      unsubEvents();
    };
  }, [office?.id]);

  const addLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'officeId'>) => {
    if (!office?.id) return;
    
    if (USE_MOCK) {
      const newLead: Lead = {
        ...leadData,
        id: `l${Date.now()}`,
        officeId: 'o1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLeads([newLead, ...leads]);
      
      addEvent({
        leadId: newLead.id,
        type: 'created',
        description: 'Lead criado via sistema',
        createdBy: user?.id || 'u1'
      });
      return;
    }
    
    await createLead({
      ...leadData,
      officeId: office.id,
      responsibleUserId: leadData.responsibleUserId || user?.id || undefined
    });
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
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

  return (
    <DataContext.Provider value={{ leads, events, tasks, loading, addLead, updateLead, addEvent }}>
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
