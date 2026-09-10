import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const secret = Deno.env.get('BACKEND_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!authorization || !url || !anon || !secret) return json({ error: 'Configuração incompleta.' }, 500);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Autenticação obrigatória.' }, 401);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from('profiles').select('office_id, role').eq('id', authData.user.id).maybeSingle();
  if (!profile?.office_id) return json({ error: 'Usuário sem escritório.' }, 412);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  if (action === 'export') {
    const tables = ['offices', 'profiles', 'memberships', 'leads', 'lead_events', 'tasks', 'calendar_events', 'financial_records', 'client_portal_access', 'lead_documents'];
    const data: Record<string, unknown[]> = {};
    for (const table of tables) {
      const query = table === 'offices' ? admin.from(table).select('*').eq('id', profile.office_id) : admin.from(table).select('*').eq('office_id', profile.office_id);
      const { data: rows, error } = await query;
      if (error) return json({ error: `Falha ao exportar ${table}.` }, 500);
      data[table] = rows || [];
    }
    return json({ officeId: profile.office_id, exportedAt: new Date().toISOString(), data });
  }
  if (profile.role !== 'owner') return json({ error: 'Somente o proprietário pode executar esta operação.' }, 403);
  if (action === 'schedule-deletion') {
    const deletionScheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from('offices').update({ deletion_scheduled_at: deletionScheduledAt }).eq('id', profile.office_id);
    return error ? json({ error: 'Não foi possível agendar a exclusão.' }, 500) : json({ deletionScheduledAt });
  }
  if (action === 'cancel-deletion') {
    const { error } = await admin.from('offices').update({ deletion_scheduled_at: null }).eq('id', profile.office_id);
    return error ? json({ error: 'Não foi possível cancelar a exclusão.' }, 500) : json({ canceled: true });
  }
  return json({ error: 'Ação desconhecida.' }, 400);
});
