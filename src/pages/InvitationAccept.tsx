import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { acceptInvitation } from '../services/supabaseTeam';

export const InvitationAccept = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, login } = useAuth();
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user || !token || state !== 'idle') return;
    setState('loading');
    acceptInvitation(token)
      .then(() => { setState('success'); window.setTimeout(() => { window.location.href = '/'; }, 700); })
      .catch(error => { console.error(error); setMessage('Este convite expirou, já foi usado ou não corresponde ao e-mail conectado.'); setState('error'); });
  }, [token, user, state]);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Verificando autenticação...</div>;
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-slate-900">Convite para a equipe</h1><p className="mt-2 text-sm text-slate-600">Entre com a conta Google que recebeu este convite para continuar.</p><Button className="mt-6 w-full" onClick={login}>Entrar com Google</Button></div></div>;
  if (state === 'success') return <Navigate to="/hoje" replace />;
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-slate-900">{state === 'loading' ? 'Aceitando convite...' : 'Não foi possível aceitar'}</h1>{message && <p className="mt-3 text-sm text-red-600">{message}</p>}{state === 'error' && <Button className="mt-6" onClick={() => { setState('idle'); setMessage(''); }}>Tentar novamente</Button>}</div></div>;
};
