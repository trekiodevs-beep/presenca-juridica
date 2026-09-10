import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Settings, LogOut, Briefcase, Route as RouteIcon, Compass, CalendarDays, CircleDollarSign, KeyRound, ListChecks, CreditCard, UsersRound, ShieldCheck, LifeBuoy, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

const navGroups = [
  {
    label: 'Início',
    items: [
      { name: 'Hoje', path: '/', icon: LayoutDashboard },
      { name: 'Central de atenção', path: '/alertas', icon: Bell },
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

const officialBrandLinks = [
  {
    name: 'TrekIO',
    href: 'https://www.trekio-tecnologia.com.br/',
    logoSrc: '/branding/trekio-oficial.png',
  },
  {
    name: 'ATOM',
    href: 'https://atominteligencia.com/',
    logoSrc: '/branding/atom-oficial.jpg',
  },
] as const;

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
      "bg-[linear-gradient(180deg,#070b12_0%,#0a1222_54%,#070b12_100%)] text-slate-300 flex flex-col h-full transition-all duration-300 shrink-0 shadow-[8px_0_30px_rgba(3,6,12,.14)]",
      mobileOpen ? "w-full" : (collapsed ? "w-20" : "w-64"),
      !mobileOpen && "hidden md:flex"
    )}>
      <div className={cn("flex py-6", (collapsed && !mobileOpen) ? "flex-col items-center px-2" : "flex-col px-6")}>
        <div className={cn("flex items-center", (collapsed && !mobileOpen) ? "justify-center" : "gap-3")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 p-1 ring-1 ring-inset ring-brand-gold/30 shadow-[0_0_18px_rgba(0,91,255,.12)]">
            <img
              src="/branding/presenca-juridica-archetype-v2.png"
              alt="Logo do Presença Jurídica CRM"
              className="h-8 w-8 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', '<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700"><span class="text-xs font-bold text-white">PJ</span></div>');
              }}
            />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="flex flex-col overflow-hidden">
              <h1 className="text-white font-semibold text-base tracking-tight leading-tight truncate">
                Presença Jurídica
              </h1>
              <span className="text-brand-gold text-[10px] font-semibold tracking-[0.16em]">INTELIGÊNCIA OPERACIONAL</span>
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-scrollbar flex-1 overflow-y-auto px-2 py-4">
        <div className="mb-5 px-1">
          <Link
            to="/leads/new"
            onClick={onCloseMobile}
            title={collapsed ? "Novo contato" : undefined}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg bg-white/[0.06] px-3 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.1] transition-colors hover:bg-white/[0.1] hover:ring-blue-400/40",
              (collapsed && !mobileOpen) ? "justify-center px-0" : "px-3"
            )}
          >
            <PlusCircle className="h-4 w-4 shrink-0 text-blue-300" />
            {(!collapsed || mobileOpen) && <span>Novo contato</span>}
          </Link>
        </div>

        <div className="space-y-5">
          {navGroups.map((group, groupIndex) => (
            <div
              key={group.label}
              className={cn(
                (collapsed && !mobileOpen) && "pt-4",
                (collapsed && !mobileOpen) && groupIndex === 0 && "pt-0"
              )}
            >
              {(!collapsed || mobileOpen) && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                        "relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                        isActive
                          ? "bg-white/[0.09] text-white shadow-sm ring-1 ring-inset ring-brand-gold/25 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand-gold"
                          : "text-slate-300/90 hover:bg-white/[0.05] hover:text-white",
                        (collapsed && !mobileOpen) && "justify-center"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-brand-gold" : "text-slate-400")} />
                      {(!collapsed || mobileOpen) && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {user?.globalRole === 'platform_admin' && (
            <div className="pt-4">
              <Link
                to="/admin"
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActivePath('/admin') ? "bg-white/[0.08] text-white shadow-sm ring-1 ring-inset ring-white/[0.08]" : "text-slate-300/90 hover:bg-white/[0.05] hover:text-white",
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

      <div className="space-y-2 p-4">
        <button
          onClick={() => {
            if (onCloseMobile) onCloseMobile();
            logout();
          }}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300/90 transition-colors hover:bg-white/[0.05] hover:text-white",
            (collapsed && !mobileOpen) ? "justify-center" : "text-left"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0 text-slate-400" />
          {(!collapsed || mobileOpen) && <span>Sair</span>}
        </button>
        <div className={cn(
          "flex items-center",
          (collapsed && !mobileOpen) ? "flex-col gap-1" : "gap-3 px-3"
        )}>
          {officialBrandLinks.map((brand) => (
            <a
              key={brand.name}
              href={brand.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir site oficial da ${brand.name}`}
              title={`Site oficial da ${brand.name}`}
              className={cn(
                "group flex min-w-0 items-center rounded-sm text-brand-400/60 transition-colors hover:text-brand-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400",
                (collapsed && !mobileOpen) ? "h-7 w-7 justify-center" : "gap-1.5 py-1"
              )}
            >
              <img
                src={brand.logoSrc}
                alt={`Logo oficial da ${brand.name}`}
                className="h-4 w-4 shrink-0 rounded-[2px] object-contain opacity-60 transition-opacity group-hover:opacity-90"
              />
              {(!collapsed || mobileOpen) && (
                <span className="truncate text-[9px] font-medium tracking-wide">
                  {brand.name}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
};
