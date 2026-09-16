import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';

const json = (request: Request, body: unknown, status = 200) => jsonWithCors(request, body, status, { 'cache-control': 'no-store' });
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const decrypt = async (value: string, secret: string) => {
  const [iv, cipher] = value.split('.');
  const key = await crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, key, decode(cipher)));
};
const accessTokenFor = async (encryptedRefreshToken: string, encryptionKey: string) => {
  const refreshToken = await decrypt(encryptedRefreshToken, encryptionKey);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID') || '',
      client_secret: Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET') || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) throw new Error('google_token_refresh_failed');
  return String(tokens.access_token);
};
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
    .update({ calendar_id: calendarId, calendar_name: calendarName || calendarId, calendar_sync_token: null, calendar_sync_token_updated_at: null, updated_at: new Date().toISOString() })
    .eq('office_id', membership.office_id)
    .eq('user_id', authData.user.id)
    .eq('provider', 'google')
    .eq('status', 'active')
    .select('id, calendar_id, calendar_name, status, encrypted_refresh_token, webhook_channel_id, webhook_resource_id')
    .maybeSingle();
  if (connectionError) {
    console.error('calendar-select connection update failed', { code: connectionError.code, message: connectionError.message });
    return json(request, { error: 'Não foi possível selecionar a agenda.', code: 'connection_update_failed' }, 500);
  }
  if (!connection) return json(request, { error: 'Reconecte sua conta Google antes de selecionar uma agenda.', code: 'google_reauthorization_required' }, 412);
  const { error: enqueueError } = await admin.rpc('enqueue_calendar_sync_for_office', { target_office_id: membership.office_id });
  if (enqueueError) console.error('calendar-select enqueue failed', { code: enqueueError.code, message: enqueueError.message, officeId: membership.office_id });
  let realtimeEnabled = false;
  const encryptionKey = Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY');
  const webhookToken = Deno.env.get('GOOGLE_CALENDAR_WEBHOOK_TOKEN');
  try {
    if (!encryptionKey || !webhookToken || !connection.encrypted_refresh_token) throw new Error('webhook_configuration_incomplete');
    const accessToken = await accessTokenFor(String(connection.encrypted_refresh_token), encryptionKey);
    if (connection.webhook_channel_id && connection.webhook_resource_id) {
      await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id: connection.webhook_channel_id, resourceId: connection.webhook_resource_id }),
      }).catch(() => undefined);
    }
    const channelId = crypto.randomUUID();
    const watchResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: `${url}/functions/v1/calendar-webhook`,
        token: webhookToken,
        expiration: String(Date.now() + 6 * 24 * 60 * 60 * 1000),
      }),
    });
    const watch = await watchResponse.json();
    if (!watchResponse.ok || !watch.resourceId) throw new Error(`google_watch_failed_${watchResponse.status}`);
    const { error: watchSaveError } = await admin.from('calendar_connections').update({
      webhook_channel_id: channelId,
      webhook_resource_id: String(watch.resourceId),
      webhook_expires_at: watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null,
    }).eq('id', connection.id);
    if (watchSaveError) throw watchSaveError;
    realtimeEnabled = true;
  } catch (watchError) {
    console.error('calendar-select watch registration failed', { officeId: membership.office_id, message: watchError instanceof Error ? watchError.message : String(watchError) });
  }
  const workerSecret = Deno.env.get('CALENDAR_SYNC_WORKER_SECRET');
  if (workerSecret) {
    await fetch(`${url}/functions/v1/calendar-reconcile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-calendar-worker-secret': workerSecret },
      body: JSON.stringify({ officeId: membership.office_id, mode: 'manual' }),
    }).catch(error => console.error('calendar-select initial reconciliation failed', { officeId: membership.office_id, message: String(error) }));
  }
  return json(request, { connection: { calendar_id: connection.calendar_id, calendar_name: connection.calendar_name, status: connection.status }, syncQueued: !enqueueError, realtimeEnabled });
});
