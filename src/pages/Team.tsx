import React, { useEffect, useState } from 'react';
import { MailPlus, Shield, UserRound, UserX } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { listenMembershipsByOffice } from '../services/supabaseDb';
import { inviteMember, listPendingInvitations, resendInvitation, revokeInvitation, setMemberStatus, transferOwnership } from '../services/supabaseTeam';
import type { Invitation, Membership, UserRole } from '../types';

const roles: Array<{ value: UserRole; label: string }> = [
  { value: 'lawyer', label: 'Advogado' },
  { value: 'assistant', label: 'Atendimento' },
  { value: 'finance', label: 'Financeiro' },
  { value: 'read', label: 'Leitura' },
];

export const Team = () => {
  const { office, user } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<Array<Omit<Invitation, 'tokenHash'>>>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('lawyer');
  const [loading, setLoading] = useState(false);
  const canManage = user?.role === 'owner' || user?.role === 'admin';

  const refreshInvitations = async () => {
    if (!canManage) return;
    try { setInvitations(await listPendingInvitations()); }
    catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (!office?.id) return;
    return listenMembershipsByOffice(office.id, setMembers);
  }, [office?.id]);

  useEffect(() => { void refreshInvitations(); }, [office?.id, canManage]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage || !email.trim()) return;
    setLoading(true);
    try {
      const result = await inviteMember(email.trim().toLowerCase(), role);
      await navigator.clipboard.writeText(result.invitationUrl);
      showToast(result.emailSent ? 'Convite enviado e link copiado.' : 'Convite criado; o link foi copiado, mas o e-mail não pôde ser enviado.', result.emailSent ? 'success' : 'info');
      setEmail('');
      await refreshInvitations();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível criar o convite. Publique as Cloud Functions antes de convidar usuários.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberStatus = async (member: Membership) => {
    if (!canManage || member.role === 'owner') return;
    const nextStatus = member.status === 'blocked' ? 'active' : 'blocked';
    try {
      await setMemberStatus(member.userId, nextStatus);
      showToast(nextStatus === 'active' ? 'Acesso reativado.' : 'Acesso bloqueado.', 'success');
    } catch (error) { console.error(error); showToast('Não foi possível alterar o acesso.', 'error'); }
  };

  const handleTransfer = async (member: Membership) => {
    if (user?.role !== 'owner' || member.status !== 'active' || !window.confirm(`Transferir a propriedade para ${member.email}?`)) return;
    try { await transferOwnership(member.userId); showToast('Propriedade transferida.', 'success'); window.location.reload(); }
    catch (error) { console.error(error); showToast('Não foi possível transferir a propriedade.', 'error'); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHeader title="Equipe e permissões" description="Convide pessoas com o menor acesso necessário para a função exercida." breadcrumbItems={[{ label: 'Equipe' }]} />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MailPlus className="h-4 w-4" />Convidar membro</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <Input type="email" required disabled={!canManage} placeholder="email@escritorio.com.br" value={email} onChange={event => setEmail(event.target.value)} />
            <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" disabled={!canManage} value={role} onChange={event => setRole(event.target.value as UserRole)}>{roles.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <Button disabled={!canManage || loading}>{loading ? 'Criando...' : 'Criar convite'}</Button>
          </form>
          {!canManage && <p className="mt-3 text-xs text-slate-500">Somente proprietário e administrador podem convidar ou remover membros.</p>}
        </CardContent>
      </Card>
      {canManage && <Card>
        <CardHeader><CardTitle>Convites pendentes ({invitations.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {invitations.length === 0 && <p className="text-sm text-slate-500">Nenhum convite pendente.</p>}
          {invitations.map(invitation => <div key={invitation.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-900">{invitation.email}</p><p className="text-xs text-slate-500">{invitation.role} · expira em {new Date(invitation.expiresAt).toLocaleDateString('pt-BR')}</p></div><div className="flex gap-3"><button className="text-xs font-semibold text-brand-700" onClick={async () => { try { const result = await resendInvitation(invitation.id); await navigator.clipboard.writeText(result.invitationUrl); showToast('Novo convite enviado e link copiado.', 'success'); await refreshInvitations(); } catch (error) { console.error(error); showToast('Não foi possível reenviar o convite.', 'error'); } }}>Reenviar</button><button className="text-xs font-semibold text-red-600" onClick={async () => { try { await revokeInvitation(invitation.id); showToast('Convite revogado.', 'success'); await refreshInvitations(); } catch (error) { console.error(error); showToast('Não foi possível revogar o convite.', 'error'); } }}>Revogar</button></div></div>)}
        </CardContent>
      </Card>}
      <Card>
        <CardHeader><CardTitle>Membros do escritório ({members.length || 1})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 && <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600"><UserRound className="h-5 w-5" />O proprietário atual aparecerá aqui depois da publicação das novas regras.</div>}
          {members.map(member => <div key={member.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><div className="rounded-full bg-brand-50 p-2 text-brand-700"><UserRound className="h-4 w-4" /></div><div><p className="font-semibold text-slate-900">{member.name || member.email}</p><p className="text-xs text-slate-500">{member.email} · {member.role} · {member.status}</p></div></div>{member.role === 'owner' ? <span className="flex items-center gap-1 text-xs font-semibold text-brand-700"><Shield className="h-4 w-4" />Proprietário</span> : <div className="flex gap-2"><button className="text-xs font-semibold text-brand-700 hover:text-brand-900" disabled={!canManage} onClick={() => handleMemberStatus(member)}>{member.status === 'blocked' ? 'Reativar' : 'Bloquear'}</button>{user?.role === 'owner' && <button className="text-xs font-semibold text-slate-500 hover:text-brand-900" disabled={!canManage || member.status !== 'active'} onClick={() => handleTransfer(member)}>Transferir propriedade</button>}<button className="text-slate-400 hover:text-red-600" title="Remover acesso" disabled={!canManage} onClick={() => setMemberStatus(member.userId, 'removed').then(() => showToast('Membro removido.', 'success')).catch(error => { console.error(error); showToast('Não foi possível remover o membro.', 'error'); })}><UserX className="h-4 w-4" /></button></div>}</div>)}
        </CardContent>
      </Card>
    </div>
  );
};
