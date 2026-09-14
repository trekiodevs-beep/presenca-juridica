import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = request.headers.get('Authorization'); const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('BACKEND_SERVICE_ROLE_KEY');
  if (!auth || !url || !anon || !secret) return json({ error: 'Configuração incompleta.' }, 500);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } }); const { data: authData } = await userClient.auth.getUser();
  if (!authData.user) return json({ error: 'Autenticação obrigatória.' }, 401);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }); const { data: profile } = await admin.from('profiles').select('global_role').eq('id', authData.user.id).maybeSingle();
  if (profile?.global_role !== 'platform_admin') return json({ error: 'Permissão insuficiente.' }, 403);
  const body = await request.json().catch(() => ({})); const action = String(body.action || '');
  if (action === 'offices') { const { data, error } = await admin.from('offices').select('*').order('created_at', { ascending: false }); return error ? json({ error: 'Falha ao listar escritórios.' }, 500) : json({ offices: data || [] }); }
  if (action === 'set-status') { const status = String(body.status || ''); if (!['TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELED'].includes(status)) return json({ error: 'Status inválido.' }, 400); const { error } = await admin.from('offices').update({ subscription_status: status }).eq('id', String(body.officeId || '')); return error ? json({ error: 'Falha ao atualizar status.' }, 500) : json({ status }); }
  if (action === 'metrics') { const { data: offices, error } = await admin.from('offices').select('subscription_status, plan_code'); if (error) return json({ error: 'Falha ao calcular métricas.' }, 500); const rows = offices || []; const active = rows.filter(row => row.subscription_status === 'ACTIVE').length; const trials = rows.filter(row => row.subscription_status === 'TRIALING').length; const canceled = rows.filter(row => row.subscription_status === 'CANCELED').length; const activated = rows.filter(row => row.plan_code !== 'trial').length; return json({ totalOffices: rows.length, active, trials, canceled, activated, activationRate: rows.length ? Math.round(activated / rows.length * 100) : 0, conversionRate: rows.length ? Math.round(active / rows.length * 100) : 0, mrr: 0 }); }
  if (action === 'inbox') { const [privacy, support] = await Promise.all([admin.from('privacy_requests').select('id, email, request_type, details, status, created_at').order('created_at', { ascending: false }).limit(100), admin.from('support_tickets').select('id, subject, message, status, created_at').order('created_at', { ascending: false }).limit(100)]); return json({ privacyRequests: (privacy.data || []).map(row => ({ id: row.id, email: row.email, requestType: row.request_type, details: row.details, status: row.status, createdAt: row.created_at })), supportTickets: (support.data || []).map(row => ({ id: row.id, subject: row.subject, message: row.message, status: row.status, createdAt: row.created_at })), integrationErrors: [] }); }
  if (action === 'inbox-update') {
    const kind = String(body.kind || ''); const id = String(body.id || ''); const status = String(body.status || '');
    const allowed = kind === 'privacy' ? ['open', 'in_progress', 'resolved', 'closed'] : ['open', 'in_progress', 'resolved', 'closed'];
    if (!id || !allowed.includes(status) || !['privacy', 'support'].includes(kind)) return json({ error: 'Atualização de inbox inválida.' }, 400);
    const table = kind === 'privacy' ? 'privacy_requests' : 'support_tickets'; const { error } = await admin.from(table).update({ status }).eq('id', id);
    return error ? json({ error: 'Não foi possível atualizar a inbox.' }, 500) : json({ status });
  }
  return json({ error: 'Ação desconhecida.' }, 400);
});
