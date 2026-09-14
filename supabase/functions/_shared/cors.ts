const allowedOrigins = new Set([
  'https://crm.trekio-tecnologia.com.br',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

export const getCorsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://crm.trekio-tecnologia.com.br',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
};

export const handleCors = (request: Request): Response | null => {
  if (request.method !== 'OPTIONS') return null;
  return new Response('ok', { status: 204, headers: getCorsHeaders(request) });
};

export const jsonWithCors = (request: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...getCorsHeaders(request), ...extraHeaders } });
