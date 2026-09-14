import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';
const json = (request: Request, body: unknown, status = 200) => jsonWithCors(request, body, status);
Deno.serve(async request => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization'); const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization || !url || !anon) return json(request, { error: 'Configuração incompleta.' }, 500);
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } }); const { data: auth } = await client.auth.getUser();
  if (!auth.user) return json(request, { error: 'Autenticação obrigatória.' }, 401);
  const body = await request.json().catch(() => ({})); const eventId = String(body.eventId || ''); const decision = String(body.decision || '');
  if (!eventId || !['crm', 'google', 'manual'].includes(decision)) return json(request, { error: 'Evento e decisão válidos são obrigatórios.' }, 400);
  const { data: event, error: eventError } = await client.from('calendar_events').select('*').eq('id', eventId).maybeSingle(); if (eventError || !event) return json(request, { error: 'Conflito não encontrado.' }, 404);
  const updates = decision === 'google' ? { sync_status: 'pending', origin: 'google' } : { sync_status: 'pending' };
  const { error } = await client.from('calendar_events').update(updates).eq('id', eventId); if (error) return json(request, { error: error.message }, 400);
  await client.from('audit_logs').insert({ office_id: event.office_id, actor_user_id: auth.user.id, action: 'calendar_conflict_resolved', target_type: 'calendar_event', target_id: eventId, metadata: { decision } });
  return json(request, { eventId, decision, status: 'pending' });
});
