import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Office } from '../types';
import { mockUser, mockOffice } from '../mockData';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, getMultiFactorResolver, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier, type MultiFactorResolver } from 'firebase/auth';
import { ensureOfficeTrial, getOrCreateUser, getOfficeById } from '../services/db';
import { acceptLegalTerms, LEGAL_VERSION } from '../lib/legal';
import { recordLoginEvent } from '../lib/audit';

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
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaVerificationId, setMfaVerificationId] = useState('');

  useEffect(() => {
    if (USE_MOCK) {
      setUser(mockUser);
      setOffice(mockOffice);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userData = await getOrCreateUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
          });
          
          setUser(userData);
          recordLoginEvent().catch(error => console.error('Login audit failed:', error));

          if (userData?.officeId) {
            const officeData = await getOfficeById(userData.officeId);
            setOffice(officeData ? await ensureOfficeTrial(officeData) : null);
          } else {
            setOffice(null);
          }
        } else {
          setUser(null);
          setOffice(null);
        }
      } catch (error) {
        console.error("Auth sync error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (USE_MOCK) {
      setUser(mockUser);
      setOffice(mockOffice);
      return true;
    }
    
    try {
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, error as Parameters<typeof getMultiFactorResolver>[1]);
        const hint = resolver.hints[0];
        if (!hint) throw new Error('Nenhum segundo fator disponível.');
        const verifier = new RecaptchaVerifier(auth, 'mfa-signin-recaptcha', { size: 'invisible' });
        try {
          const verificationId = await new PhoneAuthProvider(auth).verifyPhoneNumber({ multiFactorHint: hint, session: resolver.session }, verifier);
          setMfaResolver(resolver);
          setMfaVerificationId(verificationId);
          return false;
        } finally { verifier.clear(); }
      }
      console.error("Login failed:", error);
      throw error;
    }
  };

  const completeMfaLogin = async (code: string) => {
    if (!mfaResolver || !mfaVerificationId) throw new Error('Desafio MFA não iniciado.');
    const credential = PhoneAuthProvider.credential(mfaVerificationId, code.trim());
    await mfaResolver.resolveSignIn(PhoneMultiFactorGenerator.assertion(credential));
    setMfaResolver(null); setMfaVerificationId('');
  };

  const acceptCurrentLegalTerms = async () => {
    const result = await acceptLegalTerms();
    setUser(current => current ? { ...current, acceptedTermsVersion: LEGAL_VERSION, acceptedTermsAt: result.acceptedAt, acceptedPrivacyVersion: LEGAL_VERSION, acceptedPrivacyAt: result.acceptedAt } : current);
  };

  const logout = async () => {
    if (USE_MOCK) {
      setUser(null);
      setOffice(null);
      return;
    }
    await signOut(auth);
  };
  
  const updateUserOfficeId = async (officeId: string) => {
    if (user && !USE_MOCK) {
      setUser({ ...user, officeId });
      const officeData = await getOfficeById(officeId);
      setOffice(officeData ? await ensureOfficeTrial(officeData) : null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, office, loading, login, logout, updateUserOfficeId, setOffice, mfaChallengePending: Boolean(mfaResolver), completeMfaLogin, acceptCurrentLegalTerms }}>
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
