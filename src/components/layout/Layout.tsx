import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TrialBanner } from './TrialBanner';
import { useAuth } from '../../context/AuthContext';
import { LegalAcceptance } from '../LegalAcceptance';
import { LEGAL_VERSION } from '../../lib/legalVersion';

export const Layout = () => {
  const { user, office, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('crm_sidebar_collapsed') === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu if resized to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.getAttribute('contenteditable') === 'true'
      );
      
      if (isInput) return;

      // Esc: close mobile drawer
      if (e.key === 'Escape') {
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
          e.preventDefault();
        }
      }

      // Ctrl + B or Cmd + B: toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed(prev => {
          const newVal = !prev;
          localStorage.setItem('crm_sidebar_collapsed', String(newVal));
          return newVal;
        });
      }

      // Ctrl + N or Cmd + N: go to New Contact
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/leads/new');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-brand-950">
        <div className="flex flex-col items-center gap-4">
          <img src="/branding/presenca-juridica-archetype-v2.png" alt="" className="h-16 w-16 object-contain" />
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-brand-gold"></div>
          <p className="text-sm font-medium text-slate-400">Preparando sua operação...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.acceptedTermsVersion !== LEGAL_VERSION || user.acceptedPrivacyVersion !== LEGAL_VERSION) return <LegalAcceptance />;

  // If user is authenticated but doesn't have an officeId, force them to the settings page to create one
  if (!office && location.pathname !== '/settings') {
    return <Navigate to="/settings" />;
  }

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsSidebarCollapsed(prev => {
        const newVal = !prev;
        localStorage.setItem('crm_sidebar_collapsed', String(newVal));
        return newVal;
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6fa] font-sans">
      {/* Desktop Sidebar */}
      <Sidebar collapsed={isSidebarCollapsed} />

      {/* Mobile Drawer Sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className="relative flex flex-col max-w-xs w-64 bg-brand-900 z-50">
            <Sidebar mobileOpen={true} onCloseMobile={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar onToggleSidebar={handleToggleSidebar} />
        <TrialBanner />
        <main className="content-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
