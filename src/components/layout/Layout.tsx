import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '../../context/AuthContext';

export const Layout = () => {
  const { user, office, loading } = useAuth();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
          <p className="text-sm font-medium text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // If user is authenticated but doesn't have an officeId, force them to the settings page to create one
  if (!office && location.pathname !== '/settings') {
    return <Navigate to="/settings" />;
  }

  return (
    <div className="flex h-screen bg-[#F6F8FB] overflow-hidden font-sans">
      <Sidebar collapsed={isSidebarCollapsed} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
