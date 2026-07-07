import React from 'react';
import { Menu, Bell, Plus, Route as RouteIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const Topbar = ({ onToggleSidebar }: { onToggleSidebar?: () => void }) => {
  const { user, office } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-10">
      <div className="flex items-center gap-4 min-w-0">
        <button 
          onClick={onToggleSidebar}
          className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          aria-label="Alternar menu lateral"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-sm font-semibold text-slate-800 truncate">
          <span className="sm:hidden">
            {office?.name ? (office.name.length > 20 ? office.name.substring(0, 17) + '...' : office.name) : 'CRM'}
          </span>
          <span className="hidden sm:inline">
            {office?.name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Quick action buttons in desktop */}
        <Link 
          to="/canais" 
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <RouteIcon className="w-3.5 h-3.5 text-brand-600" />
          Canais plug-and-play
        </Link>
        <Link 
          to="/leads/new" 
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo contato
        </Link>

        {/* Divider */}
        <div className="hidden md:block h-6 w-px bg-slate-200"></div>

        <button 
          className="p-2 text-slate-400 hover:text-slate-500 relative rounded-full hover:bg-slate-50 cursor-pointer"
          aria-label="Notificações"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0 border border-brand-200 shadow-sm">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-semibold text-slate-700 leading-none">{user?.name}</div>
            <div className="text-[11px] text-slate-500 mt-1 leading-none font-medium">
              {user?.role === 'admin' ? 'Administrador' : 'Advogado'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
