import React from 'react';
import { Menu, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Topbar = ({ onToggleSidebar }: { onToggleSidebar?: () => void }) => {
  const { user, office } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block text-sm font-medium text-slate-500">
          {office?.name}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-400 hover:text-slate-500 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-sm">
            {user?.name.charAt(0)}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-slate-700">{user?.name}</div>
            <div className="text-xs text-slate-500">{user?.role === 'admin' ? 'Administrador' : 'Advogado'}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
