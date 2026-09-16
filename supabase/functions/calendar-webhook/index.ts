import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const json = (body: unknown, status = 200) => Response.json(body, { status });
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const channel = request.headers.get('x-goog-channel-id'); const resource = request.headers.get('x-goog-resource-id'); const token = request.headers.get('x-goog-channel-token');
  const url = Deno.env.get('SUPABASE_URL'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!channel || !resource || !url || !service || token !== Deno.env.get('GOOGLE_CALENDAR_WEBHOOK_TOKEN')) return json({ error: 'Notificação inválida.' }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: connection } = await admin.from('calendar_connections').select('office_id, calendar_id').eq('webhook_channel_id', channel).eq('webhook_resource_id', resource).eq('status', 'active').maybeSingle();
  if (!connection) return json({ error: 'Canal desconhecido.' }, 404);
  const workerSecret = Deno.env.get('CALENDAR_SYNC_WORKER_SECRET');
  if (!workerSecret) return json({ error: 'Configuração incompleta.' }, 500);
  const reconciliation = await fetch(`${url}/functions/v1/calendar-reconcile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-calendar-worker-secret': workerSecret },
    body: JSON.stringify({ officeId: connection.office_id, mode: 'webhook' }),
  });
  if (!reconciliation.ok) {
    console.error('calendar-webhook could not start reconciliation', { officeId: connection.office_id, status: reconciliation.status });
    return json({ error: 'Não foi possível iniciar a sincronização.' }, 503);
  }
  return json({ accepted: true }, 202);
});
