import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';
const json = (request: Request, body: unknown, status = 200) => jsonWithCors(request, body, status);
Deno.serve(async request => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization'); const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization || !url || !anon) return json(request, { error: 'Configuração incompleta.' }, 500);
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: auth } = await client.auth.getUser(); if (!auth.user) return json(request, { error: 'Autenticação obrigatória.' }, 401);
  const body = await request.json().catch(() => ({})); const eventId = String(body.eventId || '');
  if (!eventId) return json(request, { error: 'eventId é obrigatório.' }, 400);
  const { data, error } = await client.rpc('mark_calendar_event_deleted', { target_event_id: eventId });
  if (error) return json(request, { error: error.message }, error.message.includes('não autorizado') ? 403 : 400);
  return json(request, { event: data });
});
