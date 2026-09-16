import React, { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CORE_PLAN, getPlan } from '../lib/plans';
import { getAccessMode, subscriptionLabel } from '../lib/access';
import { cancelSubscription, changePlan, createCheckout, getBillingSummary, updateBillingMethod, type BillingPayment } from '../services/supabaseBilling';
import { getUsageCounter } from '../services/supabaseDb';
import type { UsageCounter } from '../types';

export const Billing = () => {
  const { office, user } = useAuth();
  const { showToast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [billingType, setBillingType] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX');
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [usage, setUsage] = useState<UsageCounter | null>(null);
  const [confirmingCancellation, setConfirmingCancellation] = useState(false);
  const [billingError, setBillingError] = useState('');
  const currentPlan = getPlan(office?.planCode);
  const currentPlanName = currentPlan.code === 'trial' ? 'Período de teste' : currentPlan.name;
  const accessMode = getAccessMode(office);
  const canManage = user?.role === 'owner' || user?.role === 'admin';
  const priceOptions = [
    { code: 'core_monthly', name: 'Mensal flexível', amountCents: 11990, monthlyCents: 11990, detail: 'Cobrança mensal, sem período mínimo.' },
    { code: 'core_quarterly', name: 'Trimestral', amountCents: 29970, monthlyCents: 9990, detail: 'Cobrança de R$ 299,70 a cada 3 meses.', featured: true },
    { code: 'core_semiannual', name: 'Semestral', amountCents: 50940, monthlyCents: 8490, detail: 'Cobrança de R$ 509,40 a cada 6 meses.' },
    { code: 'core_annual', name: 'Anual', amountCents: 95880, monthlyCents: 7990, detail: 'Cobrança de R$ 958,80 a cada 12 meses.' },
  ] as const;

  useEffect(() => {
    if (!office?.billingSubscriptionId || !canManage) return;
    setLoadingBilling(true);
    setBillingError('');
    getBillingSummary().then(summary => {
      setPayments(summary.payments);
      if (['PIX', 'BOLETO', 'CREDIT_CARD'].includes(summary.billingType || '')) setBillingType(summary.billingType as 'PIX' | 'BOLETO' | 'CREDIT_CARD');
    }).catch(error => { console.error(error); setBillingError('Não foi possível carregar as cobranças. Tente novamente em instantes.'); }).finally(() => setLoadingBilling(false));
  }, [office?.billingSubscriptionId, canManage]);
  useEffect(() => { if (office?.id) getUsageCounter(office.id).then(setUsage).catch(console.error); }, [office?.id]);

  const handleBillingMethod = async () => {
    try {
      setLoadingBilling(true);
      await updateBillingMethod(billingType);
      showToast('Forma de pagamento atualizada para as cobranças atuais e futuras.', 'success');
      setPayments((await getBillingSummary()).payments);
    } catch (error) { console.error(error); showToast('Não foi possível alterar a forma de pagamento.', 'error'); }
    finally { setLoadingBilling(false); }
  };

  const handlePlan = async (priceCode: string) => {
    if (!canManage) return;
    setLoadingPlan(priceCode);
    try {
      if (!office?.billingSubscriptionId && ![11, 14].includes(cpfCnpj.replace(/\D/g, '').length)) { showToast('Informe um CPF ou CNPJ válido para o pagador.', 'error'); return; }
      const response = office?.billingSubscriptionId && office.subscriptionStatus !== 'CANCELED' ? await changePlan(priceCode) : await createCheckout(priceCode, cpfCnpj);
      if ('checkoutUrl' in response && response.checkoutUrl) {
        window.open(response.checkoutUrl, '_blank', 'noopener,noreferrer');
        showToast('Checkout seguro aberto em uma nova aba.', 'success');
      } else {
        showToast('Plano atualizado. A próxima cobrança seguirá o novo período.', 'success');
      }
    } catch (error) {
      console.error(error);
      showToast('Não foi possível iniciar o pagamento. Confira os dados e tente novamente.', 'error');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleCancel = async () => {
    if (!canManage) return;
    setLoadingBilling(true);
    try {
      await cancelSubscription();
      showToast('Solicitação de cancelamento registrada.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível cancelar a assinatura agora.', 'error', { durationMs: null });
    } finally {
      setLoadingBilling(false);
      setConfirmingCancellation(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader title="Assinatura e plano" description="Escolha como continuar usando todos os recursos do Presença Jurídica." breadcrumbItems={[{ label: 'Assinatura e plano' }]} />

      <Card className="border-brand-200 bg-brand-50/50">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Seu plano atual</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{currentPlanName}</h2>
            <p className="mt-1 text-sm text-slate-600">{office?.subscriptionStatus ? subscriptionLabel[office.subscriptionStatus] : 'Você está no período de teste'} · até {currentPlan.limits.maxUsers} usuários · {currentPlan.limits.maxContacts.toLocaleString('pt-BR')} contatos</p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-brand-100">
            <span className="font-semibold">Acesso:</span> {accessMode === 'full' ? 'liberado' : accessMode === 'grace' ? 'liberado durante a tolerância' : 'somente leitura'}
          </div>
        </CardContent>
      </Card>

      <Card className="border-brand-200 bg-brand-50/40"><CardContent className="p-6"><h2 className="text-lg font-bold text-slate-900">Como ativar sua assinatura</h2><p className="mt-1 text-sm text-slate-600">Você conclui tudo em poucos passos. O pagamento acontece no ambiente seguro do Asaas.</p><div className="mt-5 grid gap-4 md:grid-cols-3"><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">1</span><div><p className="font-semibold text-slate-900">Escolha o período</p><p className="text-sm text-slate-600">Quanto maior o período, menor o valor mensal.</p></div></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">2</span><div><p className="font-semibold text-slate-900">Informe o CPF ou CNPJ</p><p className="text-sm text-slate-600">Usamos o documento somente para identificar o pagador.</p></div></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">3</span><div><p className="font-semibold text-slate-900">Finalize com segurança</p><p className="text-sm text-slate-600">Você será levado ao checkout do Asaas.</p></div></div></div></CardContent></Card>

      <Card><CardHeader><CardTitle>Uso do plano</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">{([['Usuários', usage?.users || 0, currentPlan.limits.maxUsers], ['Contatos', usage?.contacts || 0, currentPlan.limits.maxContacts], ['Armazenamento', usage?.storageBytes || 0, currentPlan.limits.maxStorageBytes]] as const).map(([label, value, limit]) => { const percent = Math.min(100, Math.round((value / limit) * 100)); const display = label === 'Armazenamento' ? `${(value / 1024 / 1024).toFixed(1)} MB de ${(limit / 1024 / 1024 / 1024).toFixed(1)} GB` : `${value.toLocaleString('pt-BR')} de ${limit.toLocaleString('pt-BR')}`; return <div key={label} className={percent >= 80 ? 'rounded-lg border border-amber-200 bg-amber-50 p-4' : 'rounded-lg bg-slate-50 p-4'}><div className="flex justify-between text-sm"><span className="font-semibold text-slate-800">{label}</span><span>{percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={percent >= 100 ? 'h-full bg-red-600' : percent >= 80 ? 'h-full bg-amber-500' : 'h-full bg-brand-600'} style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-slate-500">{display}</p></div>; })}</CardContent></Card>

      <div className="grid gap-4 md:grid-cols-3">
        {priceOptions.map(price => {
          const isCurrent = office?.priceCode === price.code && office.subscriptionStatus === 'ACTIVE';
          return (
            <Card key={price.code} className={isCurrent ? 'border-brand-500 shadow-md' : 'border-slate-200'}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle>{price.name}</CardTitle><p className="mt-1 text-sm text-slate-500">{price.detail}</p></div>
                  {(isCurrent || ('featured' in price && price.featured)) && <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold uppercase text-brand-700">{isCurrent ? 'Atual' : 'Mais escolhido'}</span>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold text-slate-900">R$ {(price.monthlyCents / 100).toLocaleString('pt-BR')}<span className="text-sm font-medium text-slate-500">/mês</span></p>
                <ul className="mt-5 space-y-2 text-sm text-slate-600">
                  {CORE_PLAN.features.map(feature => <li key={feature} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{feature}</li>)}
                </ul>
                <Button disabled={!canManage || isCurrent || loadingPlan !== null} onClick={() => handlePlan(price.code)} className="mt-6 w-full">
                  {loadingPlan === price.code ? 'Preparando pagamento...' : isCurrent ? 'Este é seu plano' : 'Continuar com este plano'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!office?.billingSubscriptionId && canManage && <Card><CardHeader><CardTitle>Dados do pagador</CardTitle></CardHeader><CardContent><label className="text-sm font-medium text-slate-700">CPF ou CNPJ<input className="mt-1 h-10 w-full max-w-sm rounded-md border border-slate-300 px-3" inputMode="numeric" placeholder="Somente números" value={cpfCnpj} onChange={event => setCpfCnpj(event.target.value.replace(/\D/g, '').slice(0, 14))} /></label><p className="mt-2 text-xs text-slate-500">Enviado diretamente ao backend e ao Asaas; não é salvo no navegador nem no Firestore.</p></CardContent></Card>}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Sua assinatura</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" /><p>O pagamento é processado com segurança pelo Asaas. Você pode cancelar quando quiser, e o acesso permanece ativo até o fim do período já pago.</p></div>
          <div className="flex gap-2">
            {office?.billingSubscriptionId && office.subscriptionStatus !== 'CANCELED' && <Button variant="outline" onClick={() => setConfirmingCancellation(true)} disabled={!canManage}>Cancelar assinatura</Button>}
            <Button variant="outline" onClick={() => window.open('mailto:suporte@trekio.com.br?subject=Suporte%20de%20cobrança', '_blank')}><ExternalLink className="mr-2 h-4 w-4" />Suporte</Button>
          </div>
        </CardContent>
      </Card>
      {office?.billingSubscriptionId && canManage && <Card>
        <CardHeader><CardTitle>Forma de pagamento e cobranças</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end"><label className="flex-1 text-sm font-medium text-slate-700">Forma de pagamento<select className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3" value={billingType} onChange={event => setBillingType(event.target.value as typeof billingType)}><option value="PIX">Pix</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão pelo ambiente seguro do Asaas</option></select></label><Button variant="outline" disabled={loadingBilling} onClick={handleBillingMethod}>Salvar forma de pagamento</Button></div>
          {billingError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{billingError}</p>}
          <div className="overflow-x-auto"><table className="min-w-[520px] w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">Vencimento</th><th>Status</th><th>Valor</th><th className="text-right">Documento</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id} className="border-b border-slate-100"><td className="py-3">{payment.dueDate ? new Date(`${payment.dueDate}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</td><td>{payment.status}</td><td>{payment.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="text-right">{(payment.bankSlipUrl || payment.invoiceUrl) ? <a className="font-semibold text-brand-700" href={payment.bankSlipUrl || payment.invoiceUrl || '#'} target="_blank" rel="noreferrer">Abrir 2ª via</a> : '—'}</td></tr>)}</tbody></table>{!loadingBilling && !billingError && payments.length === 0 && <p className="py-5 text-center text-sm text-slate-500">Nenhuma cobrança gerada.</p>}</div>
        </CardContent>
      </Card>}
      <ConfirmDialog open={confirmingCancellation} title="Cancelar assinatura?" description="Novas cobranças serão encerradas e o escritório passará para acesso somente leitura conforme as regras do plano." confirmLabel="Cancelar assinatura" variant="danger" loading={loadingBilling} onCancel={() => setConfirmingCancellation(false)} onConfirm={handleCancel} />
    </div>
  );
};
