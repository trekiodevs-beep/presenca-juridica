import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const valid = (value: unknown, min: number, max: number) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('BACKEND_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Configuração incompleta.' }, 500);
  const authorization = request.headers.get('Authorization');
  const userClient = authorization ? createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } }) : null;
  const { data: authData } = userClient ? await userClient.auth.getUser() : { data: { user: null } };
  const body = await request.json().catch(() => ({}));
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (body.kind === 'support') {
    if (!authData.user) return json({ error: 'Autenticação obrigatória.' }, 401);
    if (!valid(body.subject, 5, 160) || !valid(body.message, 10, 5000)) return json({ error: 'Dados inválidos.' }, 400);
    const { data: profile } = await admin.from('profiles').select('office_id').eq('id', authData.user.id).maybeSingle();
    const { data: ticket, error } = await admin.from('support_tickets').insert({ user_id: authData.user.id, office_id: profile?.office_id || null, subject: body.subject.trim(), message: body.message.trim() }).select('id').single();
    if (error) return json({ error: 'Não foi possível registrar o chamado.' }, 500);
    return json({ ticketId: ticket.id });
  }
  if (body.kind === 'privacy') {
    const email = String(body.email || '').trim().toLowerCase();
    const type = String(body.requestType || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['access', 'correction', 'deletion', 'portability', 'information', 'revocation'].includes(type) || !valid(body.details, 10, 3000)) return json({ error: 'Dados inválidos.' }, 400);
    const protocol = `PJ-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await admin.from('privacy_requests').insert({ protocol, email, request_type: type, details: body.details.trim() });
    if (error) return json({ error: 'Não foi possível registrar a solicitação.' }, 500);
    return json({ protocol });
  }
  return json({ error: 'Tipo de solicitação desconhecido.' }, 400);
});
