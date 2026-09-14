import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';

const json = (request: Request, body: unknown, status = 200) => jsonWithCors(request, body, status, { 'cache-control': 'no-store' });
Deno.serve(async request => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization'); const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('BACKEND_SERVICE_ROLE_KEY');
  if (!authorization || !url || !anon || !secret) return json(request, { error: 'Configuração incompleta.' }, 500);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } }); const { data: authData } = await userClient.auth.getUser();
  if (!authData.user) return json(request, { error: 'Autenticação obrigatória.' }, 401);
  const body = await request.json().catch(() => ({})); const calendarId = String(body.calendarId || '').trim(); const calendarName = String(body.calendarName || '').trim();
  if (!calendarId || calendarId.length > 512 || calendarName.length > 255) return json(request, { error: 'Agenda inválida.' }, 400);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: connection, error } = await admin.from('calendar_connections').update({ calendar_id: calendarId, calendar_name: calendarName || calendarId, updated_at: new Date().toISOString() }).eq('user_id', authData.user.id).eq('provider', 'google').eq('status', 'active').select('calendar_id, calendar_name, status').maybeSingle();
  if (error || !connection) return json(request, { error: 'Conexão Google não encontrada.' }, 404);
  const { data: membership, error: membershipError } = await admin.from('memberships').select('office_id').eq('user_id', authData.user.id).eq('status', 'active').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (membershipError) return json(request, { error: 'Não foi possível validar o escritório.' }, 500);
  if (membership?.office_id) await admin.rpc('enqueue_calendar_sync_for_office', { target_office_id: membership.office_id });
  return json(request, { connection });
});
