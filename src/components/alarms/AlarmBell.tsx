import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOperationalAlarms } from '../../hooks/useOperationalAlarms';

export function AlarmBell() {
  const { active, unread, critical, markRead } = useOperationalAlarms();
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <button onClick={() => setOpen(value => !value)} className="p-2 text-slate-400 hover:text-slate-600 relative rounded-full hover:bg-slate-50" aria-label={`Alertas${active.length ? ` (${active.length})` : ''}`}>
      <Bell className="w-5 h-5" />{active.length > 0 && <span className={`absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[10px] leading-4 text-white text-center rounded-full border border-white ${critical ? 'bg-red-600' : 'bg-brand-600'}`}>{active.length > 99 ? '99+' : active.length}</span>}
    </button>
    {open && <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl z-50 p-3">
      <div className="flex items-center justify-between mb-2"><strong className="text-sm text-slate-800">Central de atenção</strong><Link to="/alertas" onClick={() => setOpen(false)} className="text-xs text-brand-700">Ver tudo</Link></div>
      {!active.length ? <p className="text-xs text-slate-500 py-4">Nenhuma atenção pendente.</p> : active.slice(0, 5).map(({ alarm, recipient }) => <Link key={alarm.id} to={alarm.actionPath || '/alertas'} onClick={() => { setOpen(false); if (!recipient.readAt) void markRead(alarm.id); }} className="block w-full text-left border-t border-slate-100 py-2 hover:bg-slate-50"><div className="flex gap-2"><span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${alarm.severity === 'CRITICAL' ? 'bg-red-600' : alarm.severity === 'WARNING' ? 'bg-amber-500' : 'bg-blue-500'}`} /><div><div className="text-xs font-semibold text-slate-800">{alarm.title}</div><div className="text-[11px] text-slate-500 line-clamp-2">{alarm.message}</div></div></div></Link>)}
      {unread > 0 && <div className="text-[10px] text-slate-400 pt-1">{unread} não lido(s)</div>}
    </div>}
  </div>;
}
