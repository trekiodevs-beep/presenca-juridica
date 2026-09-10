import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (request) => {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('BACKEND_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: 'Configuração incompleta.' }, { status: 500 });
  }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return Response.json({ error: 'Autenticação obrigatória.' }, { status: 401 });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: connection, error } = await admin
    .from('calendar_connections')
    .select('provider, google_account_email, calendar_id, calendar_name, status, last_sync_at, updated_at')
    .eq('user_id', userData.user.id)
    .eq('provider', 'google')
    .maybeSingle();
  if (error) return Response.json({ error: 'Não foi possível consultar a conexão.' }, { status: 500 });

  return Response.json({ connection: connection || null });
});
