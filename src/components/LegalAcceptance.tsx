import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { useAuth } from '../context/AuthContext';

export const LegalAcceptance = () => {
  const { acceptCurrentLegalTerms, logout } = useAuth();
  const [checked, setChecked] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { await acceptCurrentLegalTerms(); } catch (submitError) { console.error(submitError); setError('Não foi possível registrar o aceite.'); } finally { setLoading(false); } };
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><form onSubmit={submit} className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold text-slate-900">Termos e privacidade</h1><p className="mt-3 leading-7 text-slate-600">Antes de usar o CRM, confirme que leu os documentos vigentes. O aceite fica versionado com data e usuário.</p><label className="mt-6 flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-700"><input className="mt-1" type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} /><span>Li e aceito os <Link className="font-semibold text-brand-700" target="_blank" to="/legal/termos">Termos de Uso</Link> e o <Link className="font-semibold text-brand-700" target="_blank" to="/legal/privacidade">Aviso de Privacidade</Link>.</span></label>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-6 flex gap-3"><Button disabled={!checked || loading}>{loading ? 'Registrando...' : 'Aceitar e continuar'}</Button><Button type="button" variant="outline" onClick={() => logout()}>Sair</Button></div></form></main>;
};
