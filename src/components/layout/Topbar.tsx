import React from 'react';
import { Menu, Plus, Route as RouteIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlarmBell } from '../alarms/AlarmBell';

export const Topbar = ({ onToggleSidebar }: { onToggleSidebar?: () => void }) => {
  const { user, office } = useAuth();

  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-[0_1px_0_rgba(242,199,120,.18)] sm:px-6 lg:px-8">
      <div className="flex items-center gap-4 min-w-0">
        <button 
          onClick={onToggleSidebar}
          className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          aria-label="Alternar menu lateral"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800 truncate">
          <span aria-hidden="true" className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(242,199,120,.75)] sm:block" />
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

        <AlarmBell />
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-gold/50 bg-[#e9efff] text-sm font-bold text-brand-700 shadow-sm">
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
