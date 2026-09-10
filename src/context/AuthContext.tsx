import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Office } from '../types';
import { mockUser, mockOffice } from '../mockData';
import { LEGAL_VERSION } from '../lib/legalVersion';
import { isSupabaseConfigured } from '../lib/supabase';
import { acceptSupabaseLegalTerms, getOrCreateSupabaseUser, getSupabaseOfficeById, getSupabaseSession, recordSupabaseLoginEvent, signInWithGoogle, signOutSupabase, subscribeSupabaseAuth } from '../services/supabaseAuth';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

interface AuthContextType {
  user: User | null;
  office: Office | null;
  loading: boolean;
  login: () => Promise<boolean>;
  mfaChallengePending: boolean;
  completeMfaLogin: (code: string) => Promise<void>;
  acceptCurrentLegalTerms: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserOfficeId: (officeId: string) => Promise<void>;
  setOffice: (office: Office) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaChallengePending] = useState(false);

  useEffect(() => {
    if (USE_MOCK) {
      setUser(mockUser);
      setOffice(mockOffice);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      console.error('Supabase não está configurado: informe VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.');
      setLoading(false);
      return;
    }

    const syncSupabaseSession = async (session: import('@supabase/supabase-js').Session | null) => {
      try {
        if (!session?.user) {
          setUser(null);
          setOffice(null);
          return;
        }
        const userData = await getOrCreateSupabaseUser(session.user);
        setUser(userData);
        if (userData.officeId) recordSupabaseLoginEvent().catch(error => console.error('Login audit failed:', error));
        setOffice(userData.officeId ? await getSupabaseOfficeById(userData.officeId) : null);
      } catch (error) {
        console.error('Supabase auth sync error:', error);
      } finally {
        setLoading(false);
      }
    };

    getSupabaseSession().then(syncSupabaseSession).catch(error => {
      console.error('Supabase session read failed:', error);
      setLoading(false);
    });
    const subscription = subscribeSupabaseAuth((_event, session) => { void syncSupabaseSession(session); });
    return () => subscription.unsubscribe();
  }, []);

  const login = async () => {
    if (USE_MOCK) {
      setUser(mockUser);
      setOffice(mockOffice);
      return true;
    }
    if (!isSupabaseConfigured) throw new Error('Supabase não está configurado para este ambiente.');
    await signInWithGoogle();
    return true;
  };

  const completeMfaLogin = async (_code: string) => {
    throw new Error('MFA legado do Firebase não está disponível após a migração para Supabase.');
  };

  const acceptCurrentLegalTerms = async () => {
    const result = await acceptSupabaseLegalTerms(user?.id || '', LEGAL_VERSION);
    setUser(current => current ? { ...current, acceptedTermsVersion: LEGAL_VERSION, acceptedTermsAt: result.acceptedAt, acceptedPrivacyVersion: LEGAL_VERSION, acceptedPrivacyAt: result.acceptedAt } : current);
  };

  const logout = async () => {
    if (USE_MOCK) {
      setUser(null);
      setOffice(null);
      return;
    }
    await signOutSupabase();
  };
  
  const updateUserOfficeId = async (officeId: string) => {
    if (user && !USE_MOCK) {
      setUser({ ...user, officeId });
      setOffice(await getSupabaseOfficeById(officeId));
    }
  };

  return (
    <AuthContext.Provider value={{ user, office, loading, login, logout, updateUserOfficeId, setOffice, mfaChallengePending, completeMfaLogin, acceptCurrentLegalTerms }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
