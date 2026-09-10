import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

Deno.serve(async request => {
  const configuredSecret = Deno.env.get('ALARM_EVALUATOR_SECRET');
  if (request.method !== 'POST' || !configuredSecret || request.headers.get('x-alarm-evaluator-secret') !== configuredSecret) return json({ error: 'Não autorizado.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('BACKEND_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!url || !serviceRoleKey) return json({ error: 'Configuração incompleta.' }, 500);
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const officeId = new URL(request.url).searchParams.get('office_id');
  const offices = officeId
    ? [{ id: officeId }]
    : (await admin.from('offices').select('id')).data || [];
  const results: Array<Record<string, unknown>> = [];
  for (const office of offices) {
    const { data, error } = await admin.rpc('evaluate_office_operational_alarms', { target_office_id: office.id });
    if (error) results.push({ officeId: office.id, error: error.message });
    else results.push((data || { officeId: office.id }) as Record<string, unknown>);
  }
  const failed = results.filter(result => result.error).length;
  return json({ evaluated: results.length, failed, results }, failed ? 207 : 200);
});
