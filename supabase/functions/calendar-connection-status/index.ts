import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonWithCors } from '../_shared/cors.ts';

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== 'GET') return jsonWithCors(request, { error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!authorization) return jsonWithCors(request, { error: 'Autenticação obrigatória.' }, 401);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonWithCors(request, { error: 'Configuração incompleta.' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonWithCors(request, { error: 'Autenticação obrigatória.' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: connection, error } = await admin
    .from('calendar_connections')
    .select('provider, google_account_email, calendar_id, calendar_name, status, last_sync_at, updated_at')
    .eq('user_id', userData.user.id)
    .eq('provider', 'google')
    .maybeSingle();
  if (error) {
    console.error('calendar-connection-status query failed', { code: error.code, message: error.message });
    return jsonWithCors(request, { error: 'Não foi possível consultar a conexão.' }, 500);
  }

  return jsonWithCors(request, { connection: connection || null });
});
