import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Circle, Clock, ListChecks, Plus, Search, UserRound } from 'lucide-react';
import { isPast, isToday, parseISO } from 'date-fns';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useData } from '../context/DataContext';
import { formatDateTime, cn } from '../lib/utils';
import { useToast } from '../context/ToastContext';

type TaskFilter = 'open' | 'today' | 'overdue' | 'done' | 'all';

export const Tasks = () => {
  const { leads, tasks, addTask, updateTask } = useData();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<TaskFilter>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [leadId, setLeadId] = useState('');
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);

  const getLeadName = (id?: string | null) => {
    if (!id) return 'Sem contato vinculado';
    return leads.find(lead => lead.id === id)?.name || 'Contato não encontrado';
  };

  const metrics = useMemo(() => {
    const open = tasks.filter(task => !task.done).length;
    const today = tasks.filter(task => !task.done && isToday(parseISO(task.dueAt))).length;
    const overdue = tasks.filter(task => !task.done && isPast(parseISO(task.dueAt)) && !isToday(parseISO(task.dueAt))).length;
    const done = tasks.filter(task => task.done).length;
    return { open, today, overdue, done };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return tasks
      .filter(task => {
        const leadName = getLeadName(task.leadId).toLowerCase();
        const matchesSearch = !term || task.title.toLowerCase().includes(term) || leadName.includes(term);

        if (!matchesSearch) return false;
        if (filter === 'open') return !task.done;
        if (filter === 'today') return !task.done && isToday(parseISO(task.dueAt));
        if (filter === 'overdue') return !task.done && isPast(parseISO(task.dueAt)) && !isToday(parseISO(task.dueAt));
        if (filter === 'done') return task.done;
        return true;
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
  }, [filter, searchTerm, tasks, leads]);

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !dueAt) return;

    setSaving(true);
    try {
      await addTask({
        leadId,
        title: title.trim(),
        dueAt: new Date(dueAt).toISOString(),
        done: false,
      });
      setTitle('');
      setLeadId('');
      setDueAt('');
      showToast('Tarefa criada.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao criar tarefa.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (taskId: string, done: boolean) => {
    await updateTask(taskId, {
      done,
      completedAt: done ? new Date().toISOString() : undefined,
    });
  };

  const filterButtonClass = (value: TaskFilter) => cn(
    'rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
    filter === value ? 'border-brand-900 bg-brand-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <PageHeader
        title="Tarefas"
        description="Controle providências internas, retornos, prazos administrativos e atividades por contato."
        breadcrumbItems={[{ label: 'Tarefas' }]}
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={() => setFilter('open')} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-blue-50 transition-colors">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <ListChecks className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none text-slate-950">{metrics.open}</span>
              <span className="text-xs font-medium text-slate-500">Abertas</span>
            </span>
          </button>
          <button onClick={() => setFilter('today')} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-emerald-50 transition-colors">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Clock className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none text-slate-950">{metrics.today}</span>
              <span className="text-xs font-medium text-slate-500">Hoje</span>
            </span>
          </button>
          <button onClick={() => setFilter('overdue')} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-rose-50 transition-colors">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-50 text-rose-700">
              <Clock className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none text-slate-950">{metrics.overdue}</span>
              <span className="text-xs font-medium text-slate-500">Vencidas</span>
            </span>
          </button>
          <button onClick={() => setFilter('done')} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 transition-colors">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none text-slate-950">{metrics.done}</span>
              <span className="text-xs font-medium text-slate-500">Concluídas</span>
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por tarefa ou contato..."
                className="pl-9 bg-slate-50 border-slate-200 h-10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="flex overflow-x-auto hide-scrollbar gap-2">
              <button onClick={() => setFilter('open')} className={filterButtonClass('open')}>Abertas</button>
              <button onClick={() => setFilter('today')} className={filterButtonClass('today')}>Hoje</button>
              <button onClick={() => setFilter('overdue')} className={filterButtonClass('overdue')}>Vencidas</button>
              <button onClick={() => setFilter('done')} className={filterButtonClass('done')}>Concluídas</button>
              <button onClick={() => setFilter('all')} className={filterButtonClass('all')}>Todas</button>
            </div>
          </div>

          {filteredTasks.length > 0 ? (
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const overdue = !task.done && isPast(parseISO(task.dueAt)) && !isToday(parseISO(task.dueAt));
                const dueToday = !task.done && isToday(parseISO(task.dueAt));

                return (
                  <article
                    key={task.id}
                    className={cn(
                      'rounded-xl border bg-white p-4 shadow-sm transition-all hover:border-brand-200 hover:shadow-md',
                      task.done ? 'border-slate-200 opacity-75' : overdue ? 'border-rose-200' : dueToday ? 'border-emerald-200' : 'border-slate-200'
                    )}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => toggleTask(task.id, !task.done)}
                          className={cn(
                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                            task.done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-400 hover:border-brand-300 hover:text-brand-700'
                          )}
                          aria-label={task.done ? 'Reabrir tarefa' : 'Concluir tarefa'}
                        >
                          {task.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                        </button>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className={cn('font-bold text-slate-950', task.done && 'line-through text-slate-500')}>{task.title}</h2>
                            {overdue && <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Vencida</span>}
                            {dueToday && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Hoje</span>}
                            {task.done && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Concluída</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              {formatDateTime(task.dueAt)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound className="h-4 w-4" />
                              {task.leadId ? <Link to={`/leads/${task.leadId}`} className="text-brand-700 hover:underline">{getLeadName(task.leadId)}</Link> : getLeadName(task.leadId)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {task.leadId && (
                        <Button asChild variant="outline" className="h-9 gap-2 shrink-0">
                          <Link to={`/leads/${task.leadId}`}>
                            Dossiê
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Nenhuma tarefa encontrada.</p>
            </div>
          )}
        </div>

        <Card className="border-slate-200 h-fit overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="text-base font-bold text-slate-950">Nova tarefa</h2>
          </div>
          <CardContent className="p-5">
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Tarefa</label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Retornar com lista de documentos" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Contato</label>
                <Select value={leadId} onChange={(event) => setLeadId(event.target.value)}>
                  <option value="">Sem vínculo</option>
                  {leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Prazo</label>
                <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required />
              </div>
              <Button type="submit" disabled={saving || !title.trim() || !dueAt} className="w-full gap-2">
                <Plus className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Criar tarefa'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
