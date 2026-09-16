import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';

const json = (request: Request, body: unknown, status = 200) => jsonWithCors(request, body, status, { 'cache-control': 'no-store' });
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const decrypt = async (value: string, secret: string) => {
  const [ivValue, cipherValue] = value.split('.');
  const keyBytes = decode(secret);
  if (!ivValue || !cipherValue || keyBytes.length !== 32) throw new Error('Chave de calendário inválida.');
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(ivValue) }, key, decode(cipherValue));
  return new TextDecoder().decode(plain);
};

Deno.serve(async request => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  const encryptionKey = Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY');
  if (!authorization) return json(request, { error: 'Autenticação obrigatória.', code: 'authentication_required' }, 401);
  if (!url || !anon || !secret || !encryptionKey) {
    console.error('calendar-list runtime configuration is incomplete');
    return json(request, { error: 'Configuração incompleta.', code: 'runtime_configuration_incomplete' }, 500);
  }
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json(request, { error: 'Autenticação obrigatória.', code: 'authentication_required' }, 401);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: membership, error: membershipError } = await admin
    .from('memberships')
    .select('office_id')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) {
    console.error('calendar-list membership query failed', { code: membershipError.code, message: membershipError.message });
    return json(request, { error: 'Não foi possível validar o escritório.', code: 'membership_query_failed' }, 500);
  }
  if (!membership?.office_id) return json(request, { error: 'Escritório não encontrado ou sem permissão.', code: 'active_membership_required' }, 403);
  const { data: connection, error: connectionError } = await admin
    .from('calendar_connections')
    .select('id, encrypted_refresh_token, status')
    .eq('office_id', membership.office_id)
    .eq('user_id', authData.user.id)
    .eq('provider', 'google')
    .maybeSingle();
  if (connectionError) {
    console.error('calendar-list connection query failed', { code: connectionError.code, message: connectionError.message });
    return json(request, { error: 'Não foi possível validar a conexão Google.', code: 'connection_query_failed' }, 500);
  }
  if (!connection || connection.status !== 'active') return json(request, { error: 'Reconecte sua conta Google para listar as agendas.', code: 'google_reauthorization_required' }, 412);
  let refreshToken = '';
  try {
    refreshToken = await decrypt(String(connection.encrypted_refresh_token), encryptionKey);
  } catch (error) {
    console.error('calendar-list refresh token decryption failed', { connectionId: connection.id, message: error instanceof Error ? error.message : String(error) });
    return json(request, { error: 'Reconecte sua conta Google para continuar.', code: 'google_reauthorization_required' }, 412);
  }
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID') || '', client_secret: Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET') || '', refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token) {
    console.error('calendar-list Google token refresh failed', { connectionId: connection.id, status: tokenResponse.status, googleError: String(tokens.error || '') });
    await admin.from('calendar_connections').update({ status: 'error', last_error: 'Falha ao renovar a autorização Google.' }).eq('id', connection.id);
    return json(request, { error: 'Sua autorização Google expirou. Reconecte a conta para continuar.', code: 'google_reauthorization_required' }, 412);
  }
  const calendarsResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer&showDeleted=false', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const calendars = await calendarsResponse.json();
  if (!calendarsResponse.ok) {
    console.error('calendar-list Google Calendar API failed', { connectionId: connection.id, status: calendarsResponse.status });
    return json(request, { error: 'O Google Agenda está temporariamente indisponível. Tente novamente.', code: 'google_calendar_unavailable' }, 502);
  }
  return json(request, { calendars: (calendars.items || []).map((item: Record<string, unknown>) => ({ id: String(item.id), summary: String(item.summary || item.id), description: item.description ? String(item.description) : null, primary: Boolean(item.primary), accessRole: String(item.accessRole || '') })) });
});
