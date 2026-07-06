import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { User, Office, Lead, LeadEvent, Task, PublicForm } from '../types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

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
    const newOfficeRef = doc(collection(db, 'offices'));
    const newOffice: Office = {
      ...office,
      id: newOfficeRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(newOfficeRef, newOffice);
    return newOfficeRef.id;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, path);
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
    
    await setDoc(newLeadRef, newLead);
    
    // Auto create event
    try {
      await addLeadEvent({
        officeId: lead.officeId,
        leadId: newLeadRef.id,
        type: 'created',
        description: lead.createdVia === 'public_form' ? 'Contato criado a partir do formulário público' : 'Contato criado no sistema',
        createdBy: lead.createdVia === 'public_form' ? 'public_form' : (lead.responsibleUserId || 'Sistema')
      });
    } catch (eventError) {
      console.warn('Failed to auto-create lead event, but lead was created:', eventError);
    }
    
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
