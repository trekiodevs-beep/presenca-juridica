import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';

const json = (request: Request, body: unknown, status = 200) => jsonWithCors(request, body, status, { 'cache-control': 'no-store' });
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const decrypt = async (value: string, secret: string) => {
  const [iv, cipher] = value.split('.');
  const key = await crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, key, decode(cipher)));
};

Deno.serve(async request => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  const encryptionKey = Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY');
  if (!authorization) return json(request, { error: 'Autenticação obrigatória.' }, 401);
  if (!url || !anon || !service || !encryptionKey) return json(request, { error: 'Configuração incompleta.' }, 500);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json(request, { error: 'Autenticação obrigatória.' }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: membership, error: membershipError } = await admin.from('memberships')
    .select('office_id')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) return json(request, { error: 'Não foi possível validar o escritório.' }, 500);
  if (!membership?.office_id) return json(request, { error: 'Escritório não encontrado ou sem permissão.' }, 403);

  const { data: connection, error: connectionError } = await admin.from('calendar_connections')
    .select('id, encrypted_refresh_token, webhook_channel_id, webhook_resource_id')
    .eq('office_id', membership.office_id)
    .eq('user_id', authData.user.id)
    .eq('provider', 'google')
    .maybeSingle();
  if (connectionError) return json(request, { error: 'Não foi possível consultar a conexão.' }, 500);
  if (!connection) return json(request, { disconnected: true, googleRevoked: true, alreadyDisconnected: true });

  let googleRevoked = false;
  try {
    const refreshToken = await decrypt(String(connection.encrypted_refresh_token), encryptionKey);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID') || '',
        client_secret: Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET') || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (tokenResponse.ok && tokens.access_token && connection.webhook_channel_id && connection.webhook_resource_id) {
      await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
        method: 'POST',
        headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id: connection.webhook_channel_id, resourceId: connection.webhook_resource_id }),
      }).catch(() => undefined);
    }
    const revokeResponse = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    });
    googleRevoked = revokeResponse.ok || revokeResponse.status === 400;
  } catch (error) {
    console.error('calendar-disconnect Google revocation failed', { message: error instanceof Error ? error.message : String(error) });
  }

  const { data: cleanup, error: cleanupError } = await admin.rpc('disconnect_google_calendar_local', {
    target_connection_id: connection.id,
    actor_user_id: authData.user.id,
  });
  if (cleanupError) {
    console.error('calendar-disconnect local cleanup failed', { code: cleanupError.code, message: cleanupError.message });
    return json(request, { error: 'Não foi possível concluir a desconexão local.' }, 500);
  }

  return json(request, { disconnected: true, googleRevoked, cleanup });
});
