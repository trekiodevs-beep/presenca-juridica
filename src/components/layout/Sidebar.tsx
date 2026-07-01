import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Settings, LogOut, Briefcase, Route as RouteIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export const Sidebar = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  const navItems = [
    { name: 'Hoje', path: '/', icon: LayoutDashboard },
    { name: 'Leads', path: '/leads', icon: Users },
    { name: 'Novo Contato', path: '/leads/new', icon: PlusCircle },
    { name: 'Canais', path: '/canais', icon: RouteIcon },
    { name: 'Dashboard', path: '/dashboard', icon: Briefcase },
    { name: 'Configurações', path: '/settings', icon: Settings },
  ];

  return (
    <aside className={cn(
      "bg-brand-900 text-slate-300 flex flex-col h-full border-r border-brand-800 hidden md:flex transition-all duration-300",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className={cn("flex py-6 border-b border-brand-800", collapsed ? "flex-col items-center px-2" : "flex-col px-6")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <img 
            src="/atom_simbolo_transparente_clean.png" 
            alt="Logo" 
            className="w-7 h-7 object-contain opacity-90 shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', '<div class="w-7 h-7 shrink-0 bg-brand-700 rounded-md flex items-center justify-center"><span class="text-white text-xs font-bold">A</span></div>');
            }}
          />
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <h1 className="text-white font-semibold text-base tracking-tight leading-tight truncate">
                Presença Jurídica
              </h1>
              <span className="text-brand-300 text-xs font-medium">CRM</span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path) && item.path !== '/leads');
          // Fix logic for /leads matching
          const isReallyActive = item.path === '/leads' ? pathname === '/leads' : isActive;

          return (
            <Link
              key={item.name}
              to={item.path}
              title={collapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                isReallyActive 
                  ? "bg-brand-800 text-white" 
                  : "hover:bg-brand-800/50 hover:text-white",
                collapsed && "justify-center"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isReallyActive ? "text-brand-100" : "text-slate-400")} />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-brand-800 space-y-4">
        <button
          onClick={logout}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium hover:bg-brand-800/50 hover:text-white w-full",
            collapsed ? "justify-center" : "text-left"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0 text-slate-400" />
          {!collapsed && <span>Sair</span>}
        </button>
        {!collapsed && (
          <div className="px-3">
            <p className="text-[10px] text-brand-400 font-medium tracking-wide">
              TrekIO + ATOM
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
