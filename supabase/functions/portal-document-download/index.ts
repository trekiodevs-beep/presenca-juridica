import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('BACKEND_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Serviço não configurado.' }, 500);

  let payload: { portalToken?: string; documentId?: string };
  try { payload = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  if (!payload.portalToken || !payload.documentId) return json({ error: 'Token e documento são obrigatórios.' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: storagePath, error: authorizationError } = await admin.rpc('get_portal_document_path', {
    portal_token: payload.portalToken,
    requested_document_id: payload.documentId,
  });
  if (authorizationError) return json({ error: 'Não foi possível validar o documento.' }, 500);
  if (!storagePath) return json({ error: 'Documento não encontrado ou não autorizado.' }, 404);

  const { data, error } = await admin.storage.from('lead-documents').createSignedUrl(String(storagePath), 300);
  if (error || !data?.signedUrl) return json({ error: 'Não foi possível gerar o download.' }, 500);
  return json({ downloadUrl: data.signedUrl, expiresInSeconds: 300 });
});
