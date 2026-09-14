import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';

const json = (request: Request, body: unknown, status = 200) => jsonWithCors(request, body, status, { 'cache-control': 'no-store' });
Deno.serve(async request => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('BACKEND_SERVICE_ROLE_KEY');
  if (!authorization || !url || !anon || !service) return json(request, { error: 'Configuração incompleta.' }, 500);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json(request, { error: 'Autenticação obrigatória.' }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: membership } = await admin.from('memberships').select('office_id, role').eq('user_id', auth.user.id).eq('status', 'active').in('role', ['owner', 'admin', 'lawyer', 'assistant']).maybeSingle();
  if (!membership) return json(request, { error: 'Escritório não encontrado ou sem permissão.' }, 403);
  const { data: connection } = await admin.from('calendar_connections').select('id, calendar_id, status, sync_enabled').eq('office_id', membership.office_id).eq('provider', 'google').maybeSingle();
  if (!connection || connection.status !== 'active' || !connection.calendar_id || !connection.sync_enabled) return json(request, { error: 'Conecte e selecione uma agenda Google antes de sincronizar.' }, 412);
  const { data: run, error: runError } = await admin.from('calendar_sync_runs').insert({ office_id: membership.office_id, requested_by: auth.user.id, mode: 'manual', status: 'running' }).select('id, status, started_at').single();
  if (runError || !run) return json(request, { error: 'Não foi possível iniciar a sincronização.' }, 500);
  const { data: queued, error: queueError } = await admin.rpc('enqueue_calendar_sync_for_office', { target_office_id: membership.office_id });
  if (queueError) {
    await admin.from('calendar_sync_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_summary: 'Falha ao enfileirar pendências.' }).eq('id', run.id);
    return json(request, { error: 'Não foi possível enfileirar as pendências.', syncRunId: run.id }, 500);
  }
  const workerSecret = Deno.env.get('CALENDAR_SYNC_WORKER_SECRET');
  if (workerSecret) {
    const headers = { 'content-type': 'application/json', 'x-calendar-worker-secret': workerSecret };
    await Promise.allSettled([
      fetch(`${url}/functions/v1/calendar-sync-worker`, { method: 'POST', headers, body: '{}' }),
      fetch(`${url}/functions/v1/calendar-reconcile`, { method: 'POST', headers, body: JSON.stringify({ officeId: membership.office_id, mode: 'manual', syncRunId: run.id }) }),
    ]);
  }
  return json(request, { syncRunId: run.id, status: 'running', queued: Number(queued || 0) }, 202);
});
