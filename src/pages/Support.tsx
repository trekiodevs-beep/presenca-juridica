import React, { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { submitSupportTicket } from '../services/supabaseRequests';

export const Support = () => {
  const { showToast } = useToast();
  const [subject, setSubject] = useState(''); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); try { const result = await submitSupportTicket({ subject, message }); showToast(`Chamado ${result.ticketId} aberto.`, 'success'); setSubject(''); setMessage(''); } catch (error) { console.error(error); showToast('Não foi possível abrir o chamado.', 'error'); } finally { setLoading(false); } };
  return <div className="mx-auto max-w-4xl space-y-6 pb-12"><PageHeader title="Ajuda e suporte" description="Consulte orientações e registre um chamado rastreável." breadcrumbItems={[{ label: 'Suporte' }]} /><Card><CardHeader><CardTitle className="flex items-center gap-2"><LifeBuoy className="h-4 w-4" />Central de ajuda</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-slate-600"><p><strong>Primeiros passos:</strong> conclua o cadastro do escritório, publique o formulário e crie o primeiro contato.</p><p><strong>Cobrança:</strong> consulte a segunda via e a forma de pagamento em Plano e cobrança.</p><p><strong>Segurança:</strong> não compartilhe contas; gerencie cada pessoa pela tela Equipe.</p></CardContent></Card><Card><CardHeader><CardTitle>Abrir chamado</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}><Input required minLength={5} maxLength={160} placeholder="Assunto" value={subject} onChange={event => setSubject(event.target.value)} /><textarea required minLength={10} maxLength={5000} className="min-h-36 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder="Descreva o problema e o resultado esperado" value={message} onChange={event => setMessage(event.target.value)} /><Button disabled={loading}>{loading ? 'Enviando...' : 'Enviar chamado'}</Button></form></CardContent></Card></div>;
};
