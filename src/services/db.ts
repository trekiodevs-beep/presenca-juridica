import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, auth, storage } from '../lib/firebase';
import {
  User,
  Office,
  Lead,
  LeadEvent,
  Task,
  PublicForm,
  LeadDocument,
  CalendarEvent,
  FinancialRecord,
  ClientPortalAccess,
  DocumentCategory,
} from '../types';
import { createTrialWindow } from '../lib/trial';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

const createPortalToken = () => {
  const randomPart = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(randomPart, value => value.toString(36)).join('');
};

// --------------------------------------------------------
// FIRESTORE ERROR HANDLING (MANDATORY per firebase-integration skill)
// --------------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --------------------------------------------------------
// USER SERVICES
// --------------------------------------------------------
export const getOrCreateUser = async (user: Partial<User>): Promise<User | null> => {
  if (USE_MOCK) return null; // Handled in AuthContext for mock
  if (!user.id) return null;

  const path = `users/${user.id}`;
  try {
    const userRef = doc(db, 'users', user.id);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as User;
    } else {
      const newUser: User = {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        role: 'admin',
        officeId: '',
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, newUser);
      return newUser;
    }
  } catch (error) {
    return handleFirestoreError(error, OperationType.GET, path);
  }
};

export const updateUser = async (userId: string, data: Partial<User>) => {
  if (USE_MOCK) return;
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --------------------------------------------------------
// OFFICE SERVICES
// --------------------------------------------------------
export const getOfficeById = async (officeId: string): Promise<Office | null> => {
  if (USE_MOCK) return null;
  const path = `offices/${officeId}`;
  try {
    const officeRef = doc(db, 'offices', officeId);
    const officeSnap = await getDoc(officeRef);
    return officeSnap.exists() ? (officeSnap.data() as Office) : null;
  } catch (error) {
    return handleFirestoreError(error, OperationType.GET, path);
  }
};

export const createOffice = async (office: Omit<Office, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (USE_MOCK) return 'mock-office';
  const path = 'offices';
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const newOfficeRef = doc(collection(db, 'offices'));
    const trialWindow = createTrialWindow();
    const newOffice = {
      ...office,
      ...trialWindow,
      id: newOfficeRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerUserId: userId
    };

    const userRef = doc(db, 'users', userId);
    const batch = writeBatch(db);

    batch.set(newOfficeRef, newOffice);
    batch.update(userRef, { officeId: newOfficeRef.id, updatedAt: serverTimestamp() });
    
    await batch.commit();

    return newOfficeRef.id;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const ensureOfficeTrial = async (office: Office): Promise<Office> => {
  if (USE_MOCK || office.subscriptionStatus || office.trialEndsAt) return office;

  const path = `offices/${office.id}`;
  try {
    const officeRef = doc(db, 'offices', office.id);
    const trialWindow = createTrialWindow();
    const updatedAt = new Date().toISOString();

    await updateDoc(officeRef, { ...trialWindow, updatedAt });

    return {
      ...office,
      ...trialWindow,
      updatedAt,
    };
  } catch (error) {
    return handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const updateOffice = async (officeId: string, data: Partial<Office>) => {
  if (USE_MOCK) return;
  const path = `offices/${officeId}`;
  try {
    const officeRef = doc(db, 'offices', officeId);
    await updateDoc(officeRef, { ...data, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --------------------------------------------------------
// PUBLIC FORMS SERVICES
// --------------------------------------------------------
export const getPublicFormBySlug = async (slug: string): Promise<PublicForm | null> => {
  if (USE_MOCK) return null;
  const path = `publicForms/${slug}`;
  try {
    const formRef = doc(db, 'publicForms', slug);
    const snap = await getDoc(formRef);
    return snap.exists() ? (snap.data() as PublicForm) : null;
  } catch (error) {
    return handleFirestoreError(error, OperationType.GET, path);
  }
};

export const updatePublicForm = async (slug: string, data: Partial<PublicForm>) => {
  if (USE_MOCK) return;
  const path = `publicForms/${slug}`;
  try {
    const formRef = doc(db, 'publicForms', slug);
    const snap = await getDoc(formRef);
    if (snap.exists()) {
      await updateDoc(formRef, { ...data, updatedAt: new Date().toISOString() });
    } else {
      await setDoc(formRef, { 
        ...data, 
        slug,
        isActive: data.isActive ?? true,
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString() 
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --------------------------------------------------------
// LEAD SERVICES
// --------------------------------------------------------
export const listenLeadsByOffice = (officeId: string, callback: (leads: Lead[]) => void) => {
  if (USE_MOCK) return () => {};
  
  const path = 'leads';
  try {
    const q = query(collection(db, 'leads'), where('officeId', '==', officeId), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const leads = snapshot.docs.map(doc => doc.data() as Lead);
      callback(leads);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const createLead = async (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (USE_MOCK) return 'mock-lead';
  
  const path = 'leads';
  try {
    const newLeadRef = doc(collection(db, 'leads'));
    const now = new Date().toISOString();
    
    const newLead: Lead = {
      ...lead,
      id: newLeadRef.id,
      createdAt: now,
      updatedAt: now,
    };
    
    const eventRef = doc(collection(db, 'leadEvents'));
    const batch = writeBatch(db);
    batch.set(newLeadRef, newLead);
    batch.set(eventRef, {
      id: eventRef.id,
      officeId: lead.officeId,
      leadId: newLeadRef.id,
      type: 'created',
      description: lead.createdVia === 'public_form' ? 'Contato criado a partir do formulário público' : 'Contato criado no sistema',
      createdBy: lead.createdVia === 'public_form' ? 'public_form' : (lead.responsibleUserId || 'Sistema'),
      createdAt: now,
    });
    await batch.commit();
    
    return newLeadRef.id;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const createPublicLead = async (
  leadData: {
    officeId: string;
    name: string;
    phone: string;
    email: string;
    city: string;
    state: string;
    area: any;
    summary: string;
    consentLgpd: boolean;
    source: any;
    status: 'Novo contato';
    priority: 'Média';
    createdVia: 'public_form';
    publicFormSlug: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }
): Promise<string> => {
  if (USE_MOCK) return 'mock-lead';
  
  const path = 'leads';
  try {
    const newLeadRef = doc(collection(db, 'leads'));
    const now = new Date().toISOString();
    
    const newLead: any = {
      id: newLeadRef.id,
      officeId: leadData.officeId,
      name: leadData.name,
      phone: leadData.phone,
      email: leadData.email,
      city: leadData.city,
      state: leadData.state,
      area: leadData.area,
      summary: leadData.summary,
      consentLgpd: leadData.consentLgpd,
      source: leadData.source,
      status: leadData.status,
      priority: leadData.priority,
      createdVia: leadData.createdVia,
      publicFormSlug: leadData.publicFormSlug,
      createdAt: now,
      updatedAt: now,
    };

    if (leadData.utmSource) newLead.utmSource = leadData.utmSource;
    if (leadData.utmMedium) newLead.utmMedium = leadData.utmMedium;
    if (leadData.utmCampaign) newLead.utmCampaign = leadData.utmCampaign;
    
    const eventRef = doc(collection(db, 'leadEvents'));
    const batch = writeBatch(db);
    batch.set(newLeadRef, newLead);
    batch.set(eventRef, {
      id: eventRef.id,
      officeId: leadData.officeId,
      leadId: newLeadRef.id,
      type: 'created',
      description: 'Contato criado a partir do formulário público',
      createdBy: 'public_form',
      createdAt: now,
    });
    await batch.commit();
    
    return newLeadRef.id;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateLead = async (leadId: string, data: Partial<Lead>, currentUserId: string) => {
  if (USE_MOCK) return;
  const path = `leads/${leadId}`;
  try {
    const leadRef = doc(db, 'leads', leadId);
    await updateDoc(leadRef, { ...data, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --------------------------------------------------------
// EVENT SERVICES
// --------------------------------------------------------
export const listenEventsByOffice = (officeId: string, callback: (events: LeadEvent[]) => void) => {
  if (USE_MOCK) return () => {};
  
  const path = 'leadEvents';
  try {
    const q = query(collection(db, 'leadEvents'), where('officeId', '==', officeId), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map(doc => doc.data() as LeadEvent);
      callback(events);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const addLeadEvent = async (event: Omit<LeadEvent, 'id' | 'createdAt'>) => {
  if (USE_MOCK) return;
  const path = 'leadEvents';
  try {
    const newEventRef = doc(collection(db, 'leadEvents'));
    const newEvent: LeadEvent = {
      ...event,
      id: newEventRef.id,
      createdAt: new Date().toISOString(),
    };
    await setDoc(newEventRef, newEvent);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// --------------------------------------------------------
// TASK SERVICES
// --------------------------------------------------------
export const listenTasksByOffice = (officeId: string, callback: (tasks: Task[]) => void) => {
  if (USE_MOCK) return () => {};

  const path = 'tasks';
  try {
    const q = query(collection(db, 'tasks'), where('officeId', '==', officeId), orderBy('dueAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Task));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const createTask = async (task: Omit<Task, 'id' | 'createdAt'>): Promise<string> => {
  if (USE_MOCK) return `mock-task-${Date.now()}`;

  const path = 'tasks';
  try {
    const taskRef = doc(collection(db, 'tasks'));
    const taskData: Task = {
      ...task,
      id: taskRef.id,
      createdAt: new Date().toISOString(),
    };

    await setDoc(taskRef, taskData);
    return taskRef.id;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateTask = async (taskId: string, updates: Partial<Task>) => {
  if (USE_MOCK) return;

  const path = `tasks/${taskId}`;
  try {
    const taskRef = doc(db, 'tasks', taskId);
    await updateDoc(taskRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --------------------------------------------------------
// DOCUMENT SERVICES
// --------------------------------------------------------
export const listenDocumentsByOffice = (officeId: string, callback: (documents: LeadDocument[]) => void) => {
  if (USE_MOCK) return () => {};

  const path = 'leadDocuments';
  try {
    const q = query(collection(db, 'leadDocuments'), where('officeId', '==', officeId), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as LeadDocument));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const uploadLeadDocument = async ({
  officeId,
  leadId,
  file,
  category,
  visibleInPortal,
  uploadedBy,
}: {
  officeId: string;
  leadId: string;
  file: File;
  category: DocumentCategory;
  visibleInPortal: boolean;
  uploadedBy: string;
}): Promise<string> => {
  if (USE_MOCK) return `mock-document-${Date.now()}`;

  const path = 'leadDocuments';
  try {
    if (!file) throw new Error('Arquivo não informado');
    if (file.size > 15 * 1024 * 1024) throw new Error('Arquivo excede o limite de 15MB');

    const documentRef = doc(collection(db, 'leadDocuments'));
    const storagePath = `offices/${officeId}/leads/${leadId}/documents/${documentRef.id}/${file.name}`;
    const fileRef = ref(storage, storagePath);

    await uploadBytes(fileRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        officeId,
        leadId,
        documentId: documentRef.id,
      },
    });

    const downloadUrl = await getDownloadURL(fileRef);
    const now = new Date().toISOString();
    const documentData: LeadDocument = {
      id: documentRef.id,
      officeId,
      leadId,
      name: file.name,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      storagePath,
      downloadUrl,
      category,
      visibleInPortal,
      uploadedBy,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(documentRef, documentData);
    return documentRef.id;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// --------------------------------------------------------
// CALENDAR SERVICES
// --------------------------------------------------------
export const listenCalendarEventsByOffice = (officeId: string, callback: (calendarEvents: CalendarEvent[]) => void) => {
  if (USE_MOCK) return () => {};

  const path = 'calendarEvents';
  try {
    const q = query(collection(db, 'calendarEvents'), where('officeId', '==', officeId), orderBy('startAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as CalendarEvent));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const createCalendarEvent = async (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (USE_MOCK) return `mock-calendar-${Date.now()}`;

  const path = 'calendarEvents';
  try {
    const eventRef = doc(collection(db, 'calendarEvents'));
    const now = new Date().toISOString();
    const eventData: CalendarEvent = {
      ...event,
      id: eventRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(eventRef, eventData);
    return eventRef.id;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateCalendarEvent = async (eventId: string, updates: Partial<CalendarEvent>) => {
  if (USE_MOCK) return;

  const path = `calendarEvents/${eventId}`;
  try {
    const eventRef = doc(db, 'calendarEvents', eventId);
    await updateDoc(eventRef, { ...updates, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --------------------------------------------------------
// FINANCIAL SERVICES
// --------------------------------------------------------
export const listenFinancialRecordsByOffice = (officeId: string, callback: (records: FinancialRecord[]) => void) => {
  if (USE_MOCK) return () => {};

  const path = 'financialRecords';
  try {
    const q = query(collection(db, 'financialRecords'), where('officeId', '==', officeId), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as FinancialRecord));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const createFinancialRecord = async (record: Omit<FinancialRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (USE_MOCK) return `mock-financial-${Date.now()}`;

  const path = 'financialRecords';
  try {
    const recordRef = doc(collection(db, 'financialRecords'));
    const now = new Date().toISOString();
    const recordData: FinancialRecord = {
      ...record,
      id: recordRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(recordRef, recordData);
    return recordRef.id;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateFinancialRecord = async (recordId: string, updates: Partial<FinancialRecord>) => {
  if (USE_MOCK) return;

  const path = `financialRecords/${recordId}`;
  try {
    const recordRef = doc(db, 'financialRecords', recordId);
    await updateDoc(recordRef, { ...updates, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// --------------------------------------------------------
// CLIENT PORTAL SERVICES
// --------------------------------------------------------
export const listenClientPortalAccessByOffice = (officeId: string, callback: (accesses: ClientPortalAccess[]) => void) => {
  if (USE_MOCK) return () => {};

  const path = 'clientPortalAccess';
  try {
    const q = query(collection(db, 'clientPortalAccess'), where('officeId', '==', officeId), orderBy('updatedAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as ClientPortalAccess));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const getClientPortalAccessByToken = async (token: string): Promise<ClientPortalAccess | null> => {
  if (USE_MOCK) return null;

  const path = `clientPortalAccess/${token}`;
  try {
    const accessRef = doc(db, 'clientPortalAccess', token);
    const snap = await getDoc(accessRef);
    return snap.exists() ? (snap.data() as ClientPortalAccess) : null;
  } catch (error) {
    return handleFirestoreError(error, OperationType.GET, path);
  }
};

export const upsertClientPortalAccess = async (
  data: Omit<ClientPortalAccess, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> => {
  if (USE_MOCK) return data.id || `mock-portal-${Date.now()}`;

  const path = 'clientPortalAccess';
  try {
    const id = data.id || createPortalToken();
    const accessRef = doc(db, 'clientPortalAccess', id);
    const snap = await getDoc(accessRef);
    const now = new Date().toISOString();
    const payload: ClientPortalAccess = {
      ...data,
      id,
      pendingItems: data.pendingItems || [],
      documents: data.documents || [],
      appointments: data.appointments || [],
      createdAt: snap.exists() ? (snap.data() as ClientPortalAccess).createdAt : now,
      updatedAt: now,
    };

    await setDoc(accessRef, payload);
    return id;
  } catch (error) {
    return handleFirestoreError(error, OperationType.WRITE, path);
  }
};
