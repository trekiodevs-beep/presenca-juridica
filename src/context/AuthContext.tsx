import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Office } from '../types';
import { mockUser, mockOffice } from '../mockData';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getOrCreateUser, getOfficeById } from '../services/db';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

interface AuthContextType {
  user: User | null;
  office: Office | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserOfficeId: (officeId: string) => Promise<void>;
  setOffice: (office: Office) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);

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

          if (userData?.officeId) {
            const officeData = await getOfficeById(userData.officeId);
            setOffice(officeData);
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
      return;
    }
    
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
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
      setOffice(officeData);
    }
  };

  return (
    <AuthContext.Provider value={{ user, office, loading, login, logout, updateUserOfficeId, setOffice }}>
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
