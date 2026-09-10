import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const json = (body: unknown, status = 200) => Response.json(body, { status });
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization'); const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization || !url || !anon) return json({ error: 'Configuração incompleta.' }, 500);
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: auth } = await client.auth.getUser(); if (!auth.user) return json({ error: 'Autenticação obrigatória.' }, 401);
  const body = await request.json().catch(() => ({})); const eventId = String(body.eventId || '');
  if (!eventId) return json({ error: 'eventId é obrigatório.' }, 400);
  const { data, error } = await client.rpc('mark_calendar_event_deleted', { target_event_id: eventId });
  if (error) return json({ error: error.message }, error.message.includes('não autorizado') ? 403 : 400);
  return json({ event: data });
});

