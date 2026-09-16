import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from './cors.ts';

export type BillingContext = { userId: string; officeId: string; admin: ReturnType<typeof createClient> };

export const getBillingContext = async (request: Request): Promise<BillingContext | Response> => {
  const authorization = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!authorization) return Response.json({ error: 'Autenticação obrigatória.', code: 'authentication_required' }, { status: 401 });
  if (!url || !anon || !service) return Response.json({ error: 'Serviço de cobrança indisponível.', code: 'runtime_configuration_incomplete' }, { status: 500 });
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return Response.json({ error: 'Autenticação obrigatória.', code: 'authentication_required' }, { status: 401 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: membership, error: membershipError } = await admin.from('memberships').select('office_id, role').eq('user_id', data.user.id).eq('status', 'active').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (membershipError) return Response.json({ error: 'Não foi possível validar o escritório.', code: 'membership_query_failed' }, { status: 500 });
  if (!membership?.office_id) return Response.json({ error: 'Escritório não encontrado ou sem permissão.', code: 'active_membership_required' }, { status: 403 });
  if (!['owner', 'admin'].includes(String(membership.role))) return Response.json({ error: 'Permissão insuficiente para gerenciar a assinatura.', code: 'billing_permission_required' }, { status: 403 });
  return { userId: data.user.id, officeId: String(membership.office_id), admin };
};

export const asaasRequest = async (path: string, init: RequestInit = {}) => {
  const baseUrl = Deno.env.get('ASAAS_API_BASE_URL') || 'https://api-sandbox.asaas.com/v3';
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  if (!apiKey) throw new Error('asaas_configuration_incomplete');
  const headers = new Headers(init.headers); headers.set('content-type', 'application/json'); headers.set('access_token', apiKey); headers.set('user-agent', 'PresencaJuridicaCRM/1.0');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(`asaas_http_${response.status}`); (error as Error & { details?: unknown }).details = body; throw error; }
  return body as Record<string, unknown>;
};

export const sanitizedAsaasError = (error: unknown) => {
  const sanitize = (value: unknown, max: number) => String(value || '')
    .slice(0, max)
    .replace(/\b\d{6,}\b/g, '[REDACTED_NUMBER]')
    .replace(/(access[_-]?token|api[_-]?key|authorization)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
  const details = error && typeof error === 'object' && 'details' in error
    ? (error as { details?: unknown }).details
    : null;
  const errors = details && typeof details === 'object' && Array.isArray((details as { errors?: unknown[] }).errors)
    ? (details as { errors: unknown[] }).errors
        .slice(0, 10)
        .map(item => item && typeof item === 'object'
          ? {
              code: sanitize((item as { code?: unknown }).code, 120),
              description: sanitize((item as { description?: unknown }).description, 500),
            }
          : null)
        .filter(Boolean)
    : [];
  return {
    message: sanitize(error instanceof Error ? error.message : error, 200),
    errors,
  };
};

export const json = (request: Request, body: unknown, status = 200) => Response.json(body, { status, headers: { ...getCorsHeaders(request), 'cache-control': 'no-store' } });

export const normalizeBillingError = async (request: Request, result: BillingContext | Response) => {
  if (!(result instanceof Response)) return null;
  return json(request, await result.json().catch(() => ({ error: 'Não foi possível processar a cobrança.' })), result.status);
};

export const intervalFor = (unit: string): string => ({ MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', SEMIANNUALLY: 'SEMIANNUALLY', YEARLY: 'YEARLY' }[unit] || 'MONTHLY');

export const addPeriod = (date: Date, unit: string) => {
  const next = new Date(date);
  if (unit === 'YEARLY') next.setUTCFullYear(next.getUTCFullYear() + 1);
  else if (unit === 'SEMIANNUALLY') next.setUTCMonth(next.getUTCMonth() + 6);
  else if (unit === 'QUARTERLY') next.setUTCMonth(next.getUTCMonth() + 3);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
};
