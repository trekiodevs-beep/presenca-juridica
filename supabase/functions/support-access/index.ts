import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!authorization || !url || !anon || !secret) return json({ error: 'Configuração incompleta.' }, 500);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Autenticação obrigatória.' }, 401);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = await request.json().catch(() => ({})); const action = String(body.action || 'list');
  const { data: profile } = await admin.from('profiles').select('office_id, role, global_role').eq('id', authData.user.id).maybeSingle();
  if (action === 'request') {
    if (profile?.global_role !== 'platform_admin') return json({ error: 'Somente o suporte autorizado pode solicitar acesso.' }, 403);
    const officeId = String(body.officeId || ''); const reason = String(body.reason || '').trim();
    if (!officeId || reason.length < 10 || reason.length > 1000) return json({ error: 'Escritório ou justificativa inválida.' }, 400);
    const { data, error } = await admin.from('support_access_requests').insert({ office_id: officeId, requested_by: authData.user.id, reason }).select('id').single();
    return error ? json({ error: 'Não foi possível registrar a solicitação.' }, 500) : json({ requestId: data.id });
  }
  if (action === 'snapshot') {
    if (profile?.global_role !== 'platform_admin') return json({ error: 'Permissão insuficiente.' }, 403);
    const requestId = String(body.requestId || '');
    const { data: access } = await admin.from('support_access_requests').select('office_id, status, expires_at').eq('id', requestId).maybeSingle();
    if (!access || access.status !== 'approved' || !access.expires_at || Date.parse(access.expires_at) <= Date.now()) return json({ error: 'Acesso de suporte ausente ou expirado.' }, 403);
    const [{ data: office }, { count: leads }, { count: tasks }, { data: usage }] = await Promise.all([
      admin.from('offices').select('id, name, lawyer_name, email, subscription_status, plan_code, trial_ends_at, onboarding_completed_at').eq('id', access.office_id).maybeSingle(),
      admin.from('leads').select('id', { count: 'exact', head: true }).eq('office_id', access.office_id),
      admin.from('tasks').select('id', { count: 'exact', head: true }).eq('office_id', access.office_id),
      admin.from('usage_counters').select('*').eq('office_id', access.office_id).maybeSingle(),
    ]);
    await admin.from('audit_logs').insert({ office_id: access.office_id, actor_user_id: authData.user.id, action: 'support.diagnostic_read', target_type: 'office', metadata: { requestId } });
    return json({ office, usage, counts: { leads: leads || 0, tasks: tasks || 0 }, accessExpiresAtMs: Date.parse(access.expires_at) });
  }
  if (action === 'list' && profile?.global_role === 'platform_admin') {
    const { data, error } = await admin.from('support_access_requests').select('id, office_id, requested_by, reason, status, requested_at, expires_at').order('requested_at', { ascending: false });
    if (error) return json({ error: 'Não foi possível listar solicitações.' }, 500);
    return json({ requests: data || [] });
  }
  if (!profile?.office_id || profile.role !== 'owner') return json({ error: 'Somente o proprietário pode decidir acesso de suporte.' }, 403);
  if (action === 'list') {
    const { data, error } = await admin.from('support_access_requests').select('id, office_id, requested_by, reason, status, requested_at, expires_at').eq('office_id', profile.office_id).order('requested_at', { ascending: false });
    if (error) return json({ error: 'Não foi possível listar solicitações.' }, 500);
    return json({ requests: data || [] });
  }
  if (action === 'decide') {
    const decision = String(body.decision || ''); const requestId = String(body.requestId || '');
    if (!requestId || !['approved', 'denied', 'revoked'].includes(decision)) return json({ error: 'Decisão inválida.' }, 400);
    const expiresAt = decision === 'approved' ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
    const { error } = await admin.from('support_access_requests').update({ status: decision, decided_at: new Date().toISOString(), decided_by: authData.user.id, expires_at: expiresAt }).eq('id', requestId).eq('office_id', profile.office_id);
    return error ? json({ error: 'Não foi possível registrar a decisão.' }, 500) : json({ status: decision, expiresAtMs: expiresAt ? Date.parse(expiresAt) : null });
  }
  return json({ error: 'Ação desconhecida.' }, 400);
});
