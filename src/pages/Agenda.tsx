import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, MapPin, Plus, RefreshCw, Trash2, UserRound } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { CalendarEvent, CalendarEventStatus, CalendarEventType } from '../types';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { CalendarSyncRequestError, resolveCalendarConflict, syncCalendarNow } from '../services/supabaseDb';

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
  const { leads, calendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent: removeCalendarEvent } = useData();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [title, setTitle] = useState('');
  const [leadId, setLeadId] = useState('');
  const [type, setType] = useState<CalendarEventType>('Consulta');
  const [startAt, setStartAt] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [connection, setConnection] = useState<{ calendar_name?: string | null; status?: string; last_sync_at?: string | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  useEffect(() => {
    void supabase.functions.invoke('calendar-connection-status', { method: 'GET' }).then(({ data }) => setConnection(data?.connection || null));
  }, []);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true); setSyncMessage('');
    try {
      const result = await syncCalendarNow();
      setSyncMessage(result.queued > 0
        ? `${result.queued} ${result.queued === 1 ? 'compromisso foi enviado' : 'compromissos foram enviados'} para sincronização com o Google Agenda.`
        : 'Agenda sincronizada. Seus compromissos já estão atualizados.');
    }
    catch (error) { console.error(error); setSyncMessage(error instanceof CalendarSyncRequestError ? error.message : 'Não foi possível sincronizar a agenda agora. Tente novamente.'); }
    finally { setSyncing(false); }
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;
    setUpdatingEventId(eventToDelete);
    try { await removeCalendarEvent(eventToDelete); showToast('Compromisso excluído. A alteração será sincronizada com o Google Agenda.', 'success'); }
    catch (error) { console.error(error); showToast('Não foi possível excluir o compromisso.', 'error', { durationMs: null }); }
    finally { setUpdatingEventId(null); setEventToDelete(null); }
  };

  const startEditing = (event: CalendarEvent) => { setEditingId(event.id); setEditTitle(event.title); setEditStartAt(new Date(event.startAt).toISOString().slice(0, 16)); setEditEndAt(event.endAt ? new Date(event.endAt).toISOString().slice(0, 16) : ''); setEditLocation(event.location || ''); setEditNotes(event.notes || ''); };
  const saveEditing = async () => { if (!editingId || !editTitle.trim() || !editStartAt) return; try { await updateCalendarEvent(editingId, { title: editTitle.trim(), startAt: new Date(editStartAt).toISOString(), endAt: editEndAt ? new Date(editEndAt).toISOString() : null, location: editLocation.trim() || null, notes: editNotes.trim() || null }); setEditingId(null); showToast('Compromisso atualizado.', 'success'); } catch { showToast('Não foi possível atualizar o compromisso.', 'error'); } };
  const handleEventStatusChange = async (eventId: string, status: CalendarEventStatus) => {
    if (updatingEventId) return;
    setUpdatingEventId(eventId);
    try {
      await updateCalendarEvent(eventId, { status });
      showToast('Status do compromisso atualizado.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível atualizar o status do compromisso.', 'error', { durationMs: null });
    } finally {
      setUpdatingEventId(null);
    }
  };

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

      <Card className="border-slate-200">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm"><p className="font-bold text-slate-900">Google Agenda</p><p className="text-slate-500">{connection?.status === 'active' ? `Agenda conectada: ${connection.calendar_name || 'agenda selecionada'}` : 'Conecte o Google Agenda em Configurações.'}{connection?.last_sync_at ? ` · Última sincronização: ${new Date(connection.last_sync_at).toLocaleString('pt-BR')}` : ''}</p>{syncMessage && <p className="mt-1 text-xs text-slate-600">{syncMessage}</p>}</div>
          <Button type="button" variant="outline" onClick={handleSync} disabled={syncing || connection?.status !== 'active'}><RefreshCw className={cn('mr-2 h-4 w-4', syncing && 'animate-spin')} />{syncing ? 'Sincronizando...' : 'Sincronizar agora'}</Button>
        </CardContent>
      </Card>

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
                    <React.Fragment key={event.id}><div className="grid grid-cols-1 md:grid-cols-[92px_1fr_170px] gap-4 p-5">
                      <div className="font-mono text-sm font-semibold text-slate-900">
                        {format(parseISO(event.startAt), 'HH:mm')}
                       </div>
                      <div className="min-w-0 border-l-4 border-brand-500 pl-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-950">{event.title}</h4>
                          {event.origin === 'google' && <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">Importado do Google Agenda</span>}
                          {event.syncStatus === 'conflict' && <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" />Conflito</span>}
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
                      <div className="space-y-2"><Select value={event.status} onChange={(changeEvent) => void handleEventStatusChange(event.id, changeEvent.target.value as CalendarEventStatus)} disabled={updatingEventId === event.id} className="w-full">{eventStatuses.map(status => <option key={status} value={status}>{status}</option>)}</Select><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => startEditing(event)}>Editar</Button><Button type="button" variant="outline" onClick={() => setEventToDelete(event.id)}><Trash2 className="mr-1 h-3.5 w-3.5" />Excluir</Button>{event.syncStatus === 'conflict' && <><Button type="button" variant="outline" onClick={async () => { try { await resolveCalendarConflict(event.id, 'crm'); showToast('Conflito enviado para prevalecer o CRM.', 'success'); } catch { showToast('Não foi possível resolver o conflito.', 'error'); } }}>Manter CRM</Button><Button type="button" variant="outline" onClick={async () => { try { await resolveCalendarConflict(event.id, 'google'); showToast('Conflito enviado para prevalecer o Google.', 'success'); } catch { showToast('Não foi possível resolver o conflito.', 'error'); } }}>Manter Google</Button><Button type="button" variant="outline" onClick={() => showToast('Revise os snapshots no histórico antes de escolher uma origem.', 'info')}>Revisar</Button></>}</div></div>
                      </div>
                      {editingId === event.id && <div className="md:col-span-3 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} aria-label="Título do compromisso" /><Input type="datetime-local" value={editStartAt} onChange={e => setEditStartAt(e.target.value)} aria-label="Início" /><Input type="datetime-local" value={editEndAt} onChange={e => setEditEndAt(e.target.value)} aria-label="Fim" /><Input value={editLocation} onChange={e => setEditLocation(e.target.value)} aria-label="Local" placeholder="Local/canal" /><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} aria-label="Observações" placeholder="Observações" /><div className="flex gap-2"><Button type="button" onClick={saveEditing}>Salvar</Button><Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button></div></div>}</React.Fragment>
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
      <ConfirmDialog open={Boolean(eventToDelete)} title="Excluir compromisso?" description="O histórico será preservado e a exclusão será propagada para os calendários integrados quando aplicável." confirmLabel="Excluir compromisso" variant="danger" loading={Boolean(updatingEventId)} onCancel={() => setEventToDelete(null)} onConfirm={handleDelete} />
    </div>
  );
};
