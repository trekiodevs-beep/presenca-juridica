import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, CheckCircle2, Clock, MapPin, Plus, UserRound } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { CalendarEventStatus, CalendarEventType } from '../types';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';

const eventTypes: CalendarEventType[] = ['Consulta', 'Retorno', 'Prazo', 'Audiência', 'Reunião', 'Outro'];
const eventStatuses: CalendarEventStatus[] = ['Agendado', 'Concluído', 'Cancelado'];

const typeStyle: Record<CalendarEventType, string> = {
  Consulta: 'bg-blue-50 text-blue-700 border-blue-100',
  Retorno: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Prazo: 'bg-rose-50 text-rose-700 border-rose-100',
  Audiência: 'bg-violet-50 text-violet-700 border-violet-100',
  Reunião: 'bg-amber-50 text-amber-700 border-amber-100',
  Outro: 'bg-slate-50 text-slate-700 border-slate-100',
};

export const Agenda = () => {
  const { user } = useAuth();
  const { leads, calendarEvents, addCalendarEvent, updateCalendarEvent } = useData();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [title, setTitle] = useState('');
  const [leadId, setLeadId] = useState('');
  const [type, setType] = useState<CalendarEventType>('Consulta');
  const [startAt, setStartAt] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const weekDays = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, index) => addDays(today, index));
  }, []);

  const sortedEvents = useMemo(() => {
    return [...calendarEvents].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [calendarEvents]);

  const selectedDateEvents = sortedEvents.filter(event => isSameDay(parseISO(event.startAt), selectedDate));
  const pendingEvents = sortedEvents.filter(event => event.status === 'Agendado');
  const overdueEvents = pendingEvents.filter(event => new Date(event.startAt).getTime() < Date.now()).length;

  const getLeadName = (id?: string | null) => {
    if (!id) return 'Sem contato vinculado';
    return leads.find(lead => lead.id === id)?.name || 'Contato não encontrado';
  };

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !startAt) return;

    setSaving(true);
    try {
      await addCalendarEvent({
        leadId: leadId || null,
        title: title.trim(),
        type,
        status: 'Agendado',
        startAt: new Date(startAt).toISOString(),
        endAt: null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        responsibleUserId: user?.id || null,
      });
      setTitle('');
      setLeadId('');
      setType('Consulta');
      setStartAt('');
      setLocation('');
      setNotes('');
      showToast('Compromisso criado na agenda.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao criar compromisso.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <PageHeader
        title="Agenda"
        description="Rotina do escritório organizada por dia, horário, contato e tipo de compromisso."
        breadcrumbItems={[{ label: 'Agenda' }]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <Card className="border-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 bg-white p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Semana operacional</p>
                  <h2 className="text-xl font-bold text-slate-950 capitalize">
                    {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <CalendarDays className="w-4 h-4" />
                  {pendingEvents.length} compromisso(s) aberto(s)
                </div>
              </div>
            </div>
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const dayEvents = sortedEvents.filter(event => isSameDay(parseISO(event.startAt), day));
                  const selected = isSameDay(day, selectedDate);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        'min-h-28 rounded-lg border p-2 text-left transition-colors',
                        selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <span className="block text-[11px] font-semibold uppercase text-slate-500">
                        {format(day, 'EEE', { locale: ptBR })}
                      </span>
                      <span className="mt-1 block text-2xl font-bold text-slate-950">{format(day, 'dd')}</span>
                      <span className="mt-3 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {dayEvents.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h3 className="text-base font-bold text-slate-950">Linha do dia</h3>
            </div>
            <CardContent className="p-0">
              {selectedDateEvents.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {selectedDateEvents.map(event => (
                    <div key={event.id} className="grid grid-cols-1 md:grid-cols-[92px_1fr_170px] gap-4 p-5">
                      <div className="font-mono text-sm font-semibold text-slate-900">
                        {format(parseISO(event.startAt), 'HH:mm')}
                      </div>
                      <div className="min-w-0 border-l-4 border-brand-500 pl-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-950">{event.title}</h4>
                          <span className={cn('rounded-md border px-2 py-0.5 text-xs font-semibold', typeStyle[event.type])}>
                            {event.type}
                          </span>
                        </div>
                        <p className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                          <UserRound className="w-4 h-4 text-slate-400" />
                          {event.leadId ? <Link to={`/leads/${event.leadId}`} className="text-brand-700 hover:underline">{getLeadName(event.leadId)}</Link> : getLeadName(event.leadId)}
                        </p>
                        {event.location && (
                          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            {event.location}
                          </p>
                        )}
                      </div>
                      <Select
                        value={event.status}
                        onChange={(changeEvent) => updateCalendarEvent(event.id, { status: changeEvent.target.value as CalendarEventStatus })}
                        className="w-full"
                      >
                        {eventStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                      </Select>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Clock className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">Nenhum compromisso para este dia.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <CalendarDays className="mb-3 h-5 w-5 text-brand-700" />
                <p className="text-2xl font-bold text-slate-950">{pendingEvents.length}</p>
                <p className="text-xs font-semibold uppercase text-slate-500">Abertos</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <Clock className="mb-3 h-5 w-5 text-rose-700" />
                <p className="text-2xl font-bold text-slate-950">{overdueEvents}</p>
                <p className="text-xs font-semibold uppercase text-slate-500">Atrasados</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-700" />
                <p className="text-2xl font-bold text-slate-950">{calendarEvents.filter(event => event.status === 'Concluído').length}</p>
                <p className="text-xs font-semibold uppercase text-slate-500">Feitos</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h3 className="text-base font-bold text-slate-950">Novo compromisso</h3>
            </div>
            <CardContent className="p-5">
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Título</label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Consulta inicial" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Contato</label>
                  <Select value={leadId} onChange={(event) => setLeadId(event.target.value)}>
                    <option value="">Sem vínculo</option>
                    {leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Tipo</label>
                    <Select value={type} onChange={(event) => setType(event.target.value as CalendarEventType)}>
                      {eventTypes.map(item => <option key={item} value={item}>{item}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Data e hora</label>
                    <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Local/canal</label>
                  <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="WhatsApp, escritório, Meet" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Observações</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[88px]"
                  />
                </div>
                <Button type="submit" disabled={saving || !title.trim() || !startAt} className="w-full gap-2">
                  <Plus className="w-4 h-4" />
                  {saving ? 'Salvando...' : 'Criar compromisso'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
