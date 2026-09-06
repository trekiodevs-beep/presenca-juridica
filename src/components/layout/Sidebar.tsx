import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Settings, LogOut, Briefcase, Route as RouteIcon, Compass, CalendarDays, CircleDollarSign, KeyRound, ListChecks, CreditCard, UsersRound, ShieldCheck, LifeBuoy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

const navGroups = [
  {
    label: 'Início',
    items: [
      { name: 'Hoje', path: '/', icon: LayoutDashboard },
      { name: 'Primeiros passos', path: '/onboarding', icon: Compass },
    ],
  },
  {
    label: 'Atendimento',
    items: [
      { name: 'Contatos', path: '/leads', icon: Users },
      { name: 'Tarefas', path: '/tarefas', icon: ListChecks },
      { name: 'Agenda', path: '/agenda', icon: CalendarDays },
    ],
  },
  {
    label: 'Relacionamento',
    items: [
      { name: 'Portal do cliente', path: '/portal', icon: KeyRound },
      { name: 'Canais de entrada', path: '/canais', icon: RouteIcon },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { name: 'Financeiro', path: '/financeiro', icon: CircleDollarSign },
      { name: 'Painel de gestão', path: '/dashboard', icon: Briefcase },
    ],
  },
    {
      label: 'Administração',
      items: [
        { name: 'Configurações', path: '/settings', icon: Settings },
        { name: 'Equipe', path: '/equipe', icon: UsersRound },
        { name: 'Plano e cobrança', path: '/billing', icon: CreditCard },
        { name: 'Privacidade e dados', path: '/privacidade', icon: ShieldCheck },
        { name: 'Segurança da conta', path: '/seguranca', icon: KeyRound },
        { name: 'Ajuda e suporte', path: '/suporte', icon: LifeBuoy },
      ],
  },
];

export const Sidebar = ({ 
  collapsed = false,
  mobileOpen = false,
  onCloseMobile
}: { 
  collapsed?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) => {
  const { pathname } = useLocation();
  const { logout, user } = useAuth();

  const isActivePath = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <aside className={cn(
      "bg-brand-900 text-slate-300 flex flex-col h-full border-r border-brand-800 transition-all duration-300 shrink-0",
      mobileOpen ? "w-full" : (collapsed ? "w-20" : "w-64"),
      !mobileOpen && "hidden md:flex"
    )}>
      <div className={cn("flex py-6 border-b border-brand-800", (collapsed && !mobileOpen) ? "flex-col items-center px-2" : "flex-col px-6")}>
        <div className={cn("flex items-center", (collapsed && !mobileOpen) ? "justify-center" : "gap-3")}>
          <img 
            src="/atom_simbolo_transparente_clean.png" 
            alt="Logo" 
            className="w-7 h-7 object-contain opacity-90 shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', '<div class="w-7 h-7 shrink-0 bg-brand-700 rounded-md flex items-center justify-center"><span class="text-white text-xs font-bold">A</span></div>');
            }}
          />
          {(!collapsed || mobileOpen) && (
            <div className="flex flex-col overflow-hidden">
              <h1 className="text-white font-semibold text-base tracking-tight leading-tight truncate">
                Presença Jurídica
              </h1>
              <span className="text-brand-300 text-xs font-medium">CRM</span>
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-scrollbar flex-1 overflow-y-auto py-5 px-3">
        <div className="mb-5 px-1">
          <Link
            to="/leads/new"
            onClick={onCloseMobile}
            title={collapsed ? "Novo contato" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-md transition-colors text-sm font-semibold bg-blue-600 text-white shadow-sm shadow-blue-950/20 hover:bg-blue-700",
              (collapsed && !mobileOpen) ? "justify-center px-0" : "px-3"
            )}
          >
            <PlusCircle className="w-5 h-5 shrink-0" />
            {(!collapsed || mobileOpen) && <span>Novo contato</span>}
          </Link>
        </div>

        <div className="space-y-5">
          {navGroups.map((group, groupIndex) => (
            <div
              key={group.label}
              className={cn(
                (collapsed && !mobileOpen) && "border-t border-brand-800/80 pt-4",
                (collapsed && !mobileOpen) && groupIndex === 0 && "border-t-0 pt-0"
              )}
            >
              {(!collapsed || mobileOpen) && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-300/80">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isActivePath(item.path);

                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      title={collapsed ? item.name : undefined}
                      onClick={onCloseMobile}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                        isActive
                          ? "bg-blue-900/70 text-white ring-1 ring-blue-700/40"
                          : "text-slate-300 hover:bg-brand-800/50 hover:text-white",
                        (collapsed && !mobileOpen) && "justify-center"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-blue-200" : "text-slate-400")} />
                      {(!collapsed || mobileOpen) && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {user?.globalRole === 'platform_admin' && (
            <div className="border-t border-brand-800/80 pt-4">
              <Link
                to="/admin"
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActivePath('/admin') ? "bg-blue-900/70 text-white" : "text-slate-300 hover:bg-brand-800/50 hover:text-white",
                  collapsed && !mobileOpen && "justify-center"
                )}
                title={collapsed ? 'Administração global' : undefined}
              >
                <Settings className="h-5 w-5 shrink-0" />
                {(!collapsed || mobileOpen) && <span>Administração global</span>}
              </Link>
            </div>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-brand-800 space-y-4">
        <button
          onClick={() => {
            if (onCloseMobile) onCloseMobile();
            logout();
          }}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium hover:bg-brand-800/50 hover:text-white w-full cursor-pointer",
            (collapsed && !mobileOpen) ? "justify-center" : "text-left"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0 text-slate-400" />
          {(!collapsed || mobileOpen) && <span>Sair</span>}
        </button>
        {(!collapsed || mobileOpen) && (
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
