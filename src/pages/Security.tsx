import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

type Factor = { id: string; friendly_name?: string | null; factor_type: string; status: string };

export const Security = () => {
  const { showToast } = useToast();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorToRemove, setFactorToRemove] = useState<string | null>(null);

  const loadFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { showToast('Não foi possível carregar os fatores de segurança.', 'error'); return; }
    setFactors((data.all || []) as Factor[]);
  };

  useEffect(() => { void loadFactors(); }, []);

  const enroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Aplicativo autenticador' });
      if (error) throw error;
      setFactorId(data.id); setQrCode(data.totp.qr_code); setSecret(data.totp.secret);
      showToast('Escaneie o QR Code no seu aplicativo autenticador.', 'success');
    } catch (error) { console.error(error); showToast('Não foi possível iniciar o MFA.', 'error'); }
    finally { setLoading(false); }
  };

  const verify = async () => {
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (error) throw error;
      setQrCode(''); setSecret(''); setFactorId(''); setCode(''); await loadFactors();
      showToast('Segundo fator ativado.', 'success');
    } catch (error) { console.error(error); showToast('Código inválido ou expirado.', 'error'); }
    finally { setLoading(false); }
  };

  const unenroll = async () => {
    if (!factorToRemove) return;
    setLoading(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factorToRemove });
    if (error) showToast('Não foi possível remover o fator.', 'error', { durationMs: null });
    else { await loadFactors(); showToast('Segundo fator removido.', 'success'); }
    setLoading(false);
    setFactorToRemove(null);
  };

  return <div className="mx-auto max-w-4xl space-y-6 pb-12"><PageHeader title="Segurança da conta" description="Ative um segundo fator usando um aplicativo autenticador." breadcrumbItems={[{ label: 'Segurança' }]} /><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Segundo fator por TOTP</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-600">Use Google Authenticator, Microsoft Authenticator ou outro aplicativo compatível. O código é gerado localmente e não depende de SMS.</p>{factors.filter(factor => factor.status === 'verified').map(factor => <div key={factor.id} className="flex items-center justify-between rounded-lg bg-emerald-50 p-4 text-sm"><span className="font-semibold text-emerald-800">{factor.friendly_name || 'Aplicativo autenticador'}</span><button className="font-semibold text-red-600" onClick={() => setFactorToRemove(factor.id)}>Remover</button></div>)}{!factors.some(factor => factor.status === 'verified') && !factorId && <Button disabled={loading} onClick={enroll}><KeyRound className="mr-2 h-4 w-4" />Configurar autenticador</Button>}{factorId && <div className="space-y-3 rounded-lg border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-900">Escaneie o QR Code e confirme o código gerado.</p>{qrCode && <img src={qrCode} alt="QR Code para configurar o autenticador" className="h-48 w-48 rounded border bg-white p-2" />}{secret && <p className="break-all text-xs text-slate-500">Chave manual: {secret}</p>}<div className="flex flex-col gap-3 sm:flex-row"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Código de 6 dígitos" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><Button disabled={loading || code.length !== 6} onClick={verify}>Ativar MFA</Button></div></div>}</CardContent></Card><ConfirmDialog open={Boolean(factorToRemove)} title="Remover segundo fator?" description="Sua conta deixará de exigir este aplicativo autenticador nos próximos acessos." confirmLabel="Remover fator" variant="danger" loading={loading} onCancel={() => setFactorToRemove(null)} onConfirm={unenroll} /></div>;
};
