import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';

const json = (request: Request, body: unknown, status = 200) => jsonWithCors(request, body, status, { 'cache-control': 'no-store' });
Deno.serve(async request => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization'); const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!authorization) return json(request, { error: 'Autenticação obrigatória.', code: 'authentication_required' }, 401);
  if (!url || !anon || !secret) return json(request, { error: 'Configuração incompleta.', code: 'runtime_configuration_incomplete' }, 500);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } }); const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json(request, { error: 'Autenticação obrigatória.', code: 'authentication_required' }, 401);
  const body = await request.json().catch(() => ({})); const calendarId = String(body.calendarId || '').trim(); const calendarName = String(body.calendarName || '').trim();
  if (!calendarId || calendarId.length > 512 || calendarName.length > 255) return json(request, { error: 'Agenda inválida.' }, 400);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: membership, error: membershipError } = await admin.from('memberships').select('office_id').eq('user_id', authData.user.id).eq('status', 'active').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (membershipError) {
    console.error('calendar-select membership query failed', { code: membershipError.code, message: membershipError.message });
    return json(request, { error: 'Não foi possível validar o escritório.', code: 'membership_query_failed' }, 500);
  }
  if (!membership?.office_id) return json(request, { error: 'Escritório não encontrado ou sem permissão.', code: 'active_membership_required' }, 403);
  const { data: connection, error: connectionError } = await admin
    .from('calendar_connections')
    .update({ calendar_id: calendarId, calendar_name: calendarName || calendarId, updated_at: new Date().toISOString() })
    .eq('office_id', membership.office_id)
    .eq('user_id', authData.user.id)
    .eq('provider', 'google')
    .eq('status', 'active')
    .select('calendar_id, calendar_name, status')
    .maybeSingle();
  if (connectionError) {
    console.error('calendar-select connection update failed', { code: connectionError.code, message: connectionError.message });
    return json(request, { error: 'Não foi possível selecionar a agenda.', code: 'connection_update_failed' }, 500);
  }
  if (!connection) return json(request, { error: 'Reconecte sua conta Google antes de selecionar uma agenda.', code: 'google_reauthorization_required' }, 412);
  const { error: enqueueError } = await admin.rpc('enqueue_calendar_sync_for_office', { target_office_id: membership.office_id });
  if (enqueueError) console.error('calendar-select enqueue failed', { code: enqueueError.code, message: enqueueError.message, officeId: membership.office_id });
  return json(request, { connection, syncQueued: !enqueueError });
});
