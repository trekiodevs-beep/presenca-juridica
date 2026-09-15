import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, CircleDollarSign, Plus, ReceiptText, TrendingUp } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useData } from '../context/DataContext';
import { FinancialRecordStatus, FinancialRecordType, PaymentMethod } from '../types';
import { formatDateTime, cn } from '../lib/utils';
import { useToast } from '../context/ToastContext';

const recordTypes: FinancialRecordType[] = ['Consulta', 'Honorários', 'Entrada', 'Parcela', 'Despesa', 'Êxito', 'Outro'];
const recordStatuses: FinancialRecordStatus[] = ['Previsto', 'Em aberto', 'Pago', 'Vencido', 'Cancelado'];
const paymentMethods: PaymentMethod[] = ['Pix', 'Boleto manual', 'Cartão externo', 'Dinheiro', 'Transferência', 'Outro'];

const statusStyle: Record<FinancialRecordStatus, string> = {
  Previsto: 'bg-slate-100 text-slate-700',
  'Em aberto': 'bg-blue-50 text-blue-700',
  Pago: 'bg-emerald-50 text-emerald-700',
  Vencido: 'bg-rose-50 text-rose-700',
  Cancelado: 'bg-slate-200 text-slate-500',
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const Finance = () => {
  const { leads, financialRecords, addFinancialRecord, updateFinancialRecord } = useData();
  const { showToast } = useToast();
  const [leadId, setLeadId] = useState('');
  const [type, setType] = useState<FinancialRecordType>('Honorários');
  const [status, setStatus] = useState<FinancialRecordStatus>('Em aberto');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingRecordId, setUpdatingRecordId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    return financialRecords.reduce(
      (acc, record) => {
        if (record.status === 'Pago') acc.paid += record.amount;
        if (record.status === 'Em aberto' || record.status === 'Previsto') acc.open += record.amount;
        if (record.status === 'Vencido') acc.overdue += record.amount;
        acc.total += record.amount;
        acc.byStatus[record.status] = (acc.byStatus[record.status] || 0) + record.amount;
        return acc;
      },
      { paid: 0, open: 0, overdue: 0, total: 0, byStatus: {} as Record<FinancialRecordStatus, number> }
    );
  }, [financialRecords]);

  const sortedRecords = useMemo(() => {
    return [...financialRecords].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [financialRecords]);

  const getLeadName = (id?: string | null) => {
    if (!id) return 'Sem contato vinculado';
    return leads.find(lead => lead.id === id)?.name || 'Contato não encontrado';
  };

  const handleCreateRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount.replace(',', '.'));
    if (!description.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) return;

    setSaving(true);
    try {
      await addFinancialRecord({
        leadId: leadId || null,
        type,
        status,
        description: description.trim(),
        amount: numericAmount,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        paidAt: status === 'Pago' ? new Date().toISOString() : null,
        paymentMethod,
        notes: notes.trim() || null,
        proofDocumentId: null,
      });
      setLeadId('');
      setType('Honorários');
      setStatus('Em aberto');
      setDescription('');
      setAmount('');
      setDueAt('');
      setPaymentMethod('Pix');
      setNotes('');
      showToast('Lançamento financeiro criado.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao criar lançamento financeiro.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (recordId: string, nextStatus: FinancialRecordStatus) => {
    if (updatingRecordId) return;
    setUpdatingRecordId(recordId);
    try {
      await updateFinancialRecord(recordId, {
        status: nextStatus,
        paidAt: nextStatus === 'Pago' ? new Date().toISOString() : null,
      });
      showToast(`Lançamento marcado como ${nextStatus.toLowerCase()}.`, 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível atualizar o lançamento financeiro.', 'error', { durationMs: null });
    } finally {
      setUpdatingRecordId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <PageHeader
        title="Financeiro"
        description="Honorários, consultas, parcelas, vencimentos e recebimentos em uma visão de operação."
        breadcrumbItems={[{ label: 'Financeiro' }]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-emerald-100 bg-emerald-50/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <TrendingUp className="h-6 w-6 text-emerald-700" />
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-emerald-700">Pago</span>
                </div>
                <p className="mt-5 text-3xl font-bold text-slate-950">{currencyFormatter.format(metrics.paid)}</p>
                <p className="mt-1 text-xs font-semibold uppercase text-emerald-800">Recebido</p>
              </CardContent>
            </Card>
            <Card className="border-blue-100 bg-blue-50/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <CircleDollarSign className="h-6 w-6 text-blue-700" />
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-700">Aberto</span>
                </div>
                <p className="mt-5 text-3xl font-bold text-slate-950">{currencyFormatter.format(metrics.open)}</p>
                <p className="mt-1 text-xs font-semibold uppercase text-blue-800">A receber</p>
              </CardContent>
            </Card>
            <Card className="border-rose-100 bg-rose-50/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <AlertTriangle className="h-6 w-6 text-rose-700" />
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-rose-700">Atenção</span>
                </div>
                <p className="mt-5 text-3xl font-bold text-slate-950">{currencyFormatter.format(metrics.overdue)}</p>
                <p className="mt-1 text-xs font-semibold uppercase text-rose-800">Vencido</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 bg-white px-5 py-4">
              <h2 className="text-base font-bold text-slate-950">Distribuição da carteira</h2>
            </div>
            <CardContent className="p-5 space-y-4">
              {recordStatuses.map(item => {
                const value = metrics.byStatus[item] || 0;
                const percent = metrics.total > 0 ? Math.round((value / metrics.total) * 100) : 0;
                return (
                  <div key={item} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item}</span>
                      <span className="font-semibold text-slate-950">{currencyFormatter.format(value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-950">Lançamentos</h2>
              <span className="text-xs font-semibold uppercase text-slate-500">{sortedRecords.length} registro(s)</span>
            </div>
            <CardContent className="p-0">
              {sortedRecords.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {sortedRecords.map(record => (
                    <div key={record.id} className="grid grid-cols-1 xl:grid-cols-[1fr_170px_150px] gap-4 p-5 items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <ReceiptText className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-bold text-slate-950">{record.description}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{record.type}</span>
                          <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', statusStyle[record.status])}>{record.status}</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {record.leadId ? <Link to={`/leads/${record.leadId}`} className="text-brand-700 hover:underline">{getLeadName(record.leadId)}</Link> : getLeadName(record.leadId)}
                          {record.dueAt ? ` · vencimento ${formatDateTime(record.dueAt)}` : ''}
                          {record.paymentMethod ? ` · ${record.paymentMethod}` : ''}
                        </p>
                      </div>
                      <p className="text-xl font-bold text-slate-950 xl:text-right">{currencyFormatter.format(record.amount)}</p>
                      <Select
                        value={record.status}
                        onChange={(event) => void handleStatusChange(record.id, event.target.value as FinancialRecordStatus)}
                        disabled={updatingRecordId === record.id}
                        className="w-full"
                      >
                        {recordStatuses.map(item => <option key={item} value={item}>{item}</option>)}
                      </Select>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Banknote className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">Nenhum lançamento financeiro registrado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 h-fit overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h3 className="text-base font-bold text-slate-950">Novo lançamento</h3>
          </div>
          <CardContent className="p-5">
            <form onSubmit={handleCreateRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Descrição</label>
                <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex: Honorários iniciais" required />
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
                  <Select value={type} onChange={(event) => setType(event.target.value as FinancialRecordType)}>
                    {recordTypes.map(item => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Status</label>
                  <Select value={status} onChange={(event) => setStatus(event.target.value as FinancialRecordStatus)}>
                    {recordStatuses.map(item => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Valor</label>
                  <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Vencimento</label>
                  <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Forma de pagamento</label>
                <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                  {paymentMethods.map(item => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Observações</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[88px]"
                />
              </div>
              <Button type="submit" disabled={saving || !description.trim() || !amount} className="w-full gap-2">
                <Plus className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Criar lançamento'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
