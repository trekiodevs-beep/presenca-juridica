import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== 'POST') return jsonWithCors(request, { error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID');
  const redirectUri = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI') || `${supabaseUrl || 'http://127.0.0.1:54321'}/functions/v1/calendar-oauth-callback`;
  if (!authorization) return jsonWithCors(request, { error: 'Autenticação obrigatória.' }, 401);
  const missing = [
    !supabaseUrl && 'SUPABASE_URL',
    !anonKey && 'SUPABASE_ANON_KEY',
    !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !clientId && 'GOOGLE_CALENDAR_CLIENT_ID (ou SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)',
  ].filter(Boolean);
  if (missing.length > 0) {
    console.error(`calendar-oauth-start missing: ${missing.join(',')}`);
    return jsonWithCors(request, { error: 'Configuração OAuth incompleta.', missing }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonWithCors(request, { error: 'Autenticação obrigatória.' }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: membership, error: membershipError } = await admin
    .from('memberships')
    .select('office_id')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) {
    console.error('calendar-oauth-start membership query failed', { code: membershipError.code, message: membershipError.message });
    return jsonWithCors(request, { error: 'Não foi possível validar o escritório.' }, 500);
  }
  if (!membership?.office_id) return jsonWithCors(request, { error: 'Usuário sem vínculo ativo com um escritório.' }, 412);
  const state = crypto.randomUUID();
  const { error } = await admin.from('calendar_oauth_states').insert({ state, user_id: userData.user.id, office_id: membership.office_id, redirect_uri: redirectUri, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  if (error) {
    console.error('calendar-oauth-start state insert failed', { code: error.code, message: error.message });
    return jsonWithCors(request, { error: 'Não foi possível iniciar a autorização.' }, 500);
  }
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly', state });
  return jsonWithCors(request, { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});
