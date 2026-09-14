import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async request => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const json = (body: unknown, status = 200) =>
    jsonWithCors(request, body, status, { 'cache-control': 'no-store' });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('BACKEND_SERVICE_ROLE_KEY');
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Configuração incompleta.' }, 500);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Autenticação obrigatória.' }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from('profiles').select('office_id, role, email').eq('id', authData.user.id).maybeSingle();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || 'list');

  if (action === 'accept') {
    const token = String(body.token || '');
    if (!token) return json({ error: 'Convite inválido.' }, 400);
    const { data: invitation } = await admin.from('invitations').select('*').eq('token_hash', await hashToken(token)).eq('status', 'pending').gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!invitation || invitation.email.toLowerCase() !== String(authData.user.email || '').toLowerCase()) return json({ error: 'Convite inválido ou e-mail divergente.' }, 403);
    const { error: membershipError } = await admin.from('memberships').upsert({ office_id: invitation.office_id, user_id: authData.user.id, email: authData.user.email, name: String(authData.user.user_metadata?.full_name || authData.user.email || ''), role: invitation.role, status: 'active' }, { onConflict: 'office_id,user_id' });
    if (membershipError) return json({ error: 'Não foi possível ativar o membro.' }, 500);
    await admin.from('invitations').update({ status: 'accepted', accepted_by: authData.user.id, accepted_at: new Date().toISOString() }).eq('id', invitation.id);
    await admin.from('profiles').update({ office_id: invitation.office_id, role: invitation.role }).eq('id', authData.user.id);
    return json({ officeId: invitation.office_id });
  }

  if (!profile?.office_id || !['owner', 'admin'].includes(String(profile.role))) return json({ error: 'Permissão insuficiente.' }, 403);
  if (action === 'member-status') {
    const userId = String(body.userId || '');
    const status = String(body.status || '');
    if (!userId || !['active', 'blocked', 'removed'].includes(status) || userId === authData.user.id) return json({ error: 'Alteração de membro inválida.' }, 400);
    const { data: member } = await admin.from('memberships').select('role').eq('office_id', profile.office_id).eq('user_id', userId).maybeSingle();
    if (!member || member.role === 'owner' || (member.role === 'admin' && profile.role !== 'owner')) return json({ error: 'Membro não pode ser alterado.' }, 403);
    const { error } = await admin.from('memberships').update({ status }).eq('office_id', profile.office_id).eq('user_id', userId);
    return error ? json({ error: 'Não foi possível alterar o acesso.' }, 500) : json({ status });
  }
  if (action === 'transfer-ownership') {
    const userId = String(body.userId || '');
    if (profile.role !== 'owner' || !userId || userId === authData.user.id) return json({ error: 'Somente o proprietário pode transferir a propriedade.' }, 403);
    const { data: target } = await admin.from('memberships').select('status').eq('office_id', profile.office_id).eq('user_id', userId).maybeSingle();
    if (!target || target.status !== 'active') return json({ error: 'O novo proprietário precisa ser membro ativo.' }, 412);
    const { data: officeId, error } = await admin.rpc('transfer_office_ownership', { actor_user_id: authData.user.id, target_user_id: userId });
    return error ? json({ error: 'Não foi possível transferir a propriedade.' }, 500) : json({ officeId });
  }
  if (action === 'list') {
    const { data, error } = await admin.from('invitations').select('id, office_id, email, role, status, expires_at, created_by, accepted_by, accepted_at, created_at, updated_at').eq('office_id', profile.office_id).eq('status', 'pending').order('created_at', { ascending: false });
    if (error) return json({ error: 'Não foi possível listar convites.' }, 500);
    return json({ invitations: data || [] });
  }
  if (action === 'revoke') {
    const { error } = await admin.from('invitations').update({ status: 'revoked' }).eq('id', String(body.invitationId)).eq('office_id', profile.office_id).eq('status', 'pending');
    return error ? json({ error: 'Não foi possível revogar o convite.' }, 500) : json({ status: 'revoked' });
  }
  if (action === 'invite' || action === 'resend') {
    let email = String(body.email || '').trim().toLowerCase();
    let role = String(body.role || 'assistant');
    const invitationId = action === 'resend' ? String(body.invitationId || '') : '';
    if (invitationId) {
      const { data: previous } = await admin.from('invitations').select('email, role').eq('id', invitationId).eq('office_id', profile.office_id).eq('status', 'pending').maybeSingle();
      if (!previous) return json({ error: 'Convite não encontrado.' }, 404);
      email = String(previous.email).toLowerCase();
      role = String(previous.role);
    }
    if (!email || !email.includes('@') || !['admin', 'lawyer', 'assistant', 'finance', 'read'].includes(role)) return json({ error: 'Dados do convite inválidos.' }, 400);
    if (invitationId) await admin.from('invitations').update({ status: 'revoked' }).eq('id', invitationId).eq('office_id', profile.office_id).eq('status', 'pending');
    const token = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
    const { data: invitation, error } = await admin.from('invitations').insert({ office_id: profile.office_id, email, role, token_hash: await hashToken(token), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), created_by: authData.user.id }).select('id').single();
    if (error) return json({ error: 'Não foi possível criar o convite.' }, 500);
    const appUrl = Deno.env.get('APP_URL') || 'http://127.0.0.1:3000';
    return json({ invitationUrl: `${appUrl}/convites/${token}`, emailSent: false, invitationId: invitation.id });
  }
  return json({ error: 'Ação desconhecida.' }, 400);
});
