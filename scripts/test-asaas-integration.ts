import assert from 'node:assert/strict';

type Json = Record<string, unknown>;

const args = new Set(process.argv.slice(2));
const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
};

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') || process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const functionBase = `${supabaseUrl?.replace(/\/$/, '')}/functions/v1`;

const requestJson = async (url: string, init: RequestInit = {}) => {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { response, body: body as Json };
};

const check = (condition: unknown, message: string) => {
  assert.ok(condition, message);
  console.log(`PASS  ${message}`);
};

const signIn = async () => {
  if (!supabaseUrl || !publishableKey) throw new Error('Defina SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_PUBLISHABLE_KEY.');
  const { response, body } = await requestJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: required('ASAAS_TEST_EMAIL'), password: required('ASAAS_TEST_PASSWORD') }),
  });
  check(response.ok && typeof body.access_token === 'string', 'usuário de homologação autentica no Supabase');
  return String(body.access_token);
};

const main = async () => {
  if (args.has('--help')) {
    console.log('Uso: npm run test:asaas:sandbox');
    console.log('Variáveis: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ASAAS_TEST_EMAIL, ASAAS_TEST_PASSWORD, ASAAS_TEST_CPF_CNPJ');
    console.log('Opcional: ASAAS_FUNCTION_BASE_URL para apontar para outro projeto Supabase.');
    return;
  }
  if (!supabaseUrl && !process.env.ASAAS_FUNCTION_BASE_URL) throw new Error('Defina SUPABASE_URL ou ASAAS_FUNCTION_BASE_URL.');
  const base = (process.env.ASAAS_FUNCTION_BASE_URL || functionBase).replace(/\/$/, '');
  const token = await signIn();
  const authHeaders = { Authorization: `Bearer ${token}`, apikey: publishableKey || '' };

  const summary = await requestJson(`${base}/billing-summary`, { headers: authHeaders });
  check(summary.response.ok, `billing-summary responde ${summary.response.status}`);
  check(typeof summary.body.status === 'string' || summary.body.status === null, 'billing-summary devolve o estado local da assinatura');
  check(Array.isArray(summary.body.payments), 'billing-summary devolve histórico seguro de cobranças');

  const invalid = await requestJson(`${base}/billing-create-checkout`, {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ priceCode: 'invalid_test_price', billingType: 'PIX', payer: { cpfCnpj: '000' } }),
  });
  check(invalid.response.status === 400, `entrada inválida é rejeitada com HTTP 400 (recebido ${invalid.response.status})`);
  check(invalid.body.code === 'invalid_price', 'erro de entrada preserva código de negócio');

  const checkout = await requestJson(`${base}/billing-create-checkout`, {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      priceCode: process.env.ASAAS_TEST_PRICE_CODE || 'core_monthly',
      billingType: process.env.ASAAS_TEST_BILLING_TYPE || 'PIX',
      payer: { cpfCnpj: required('ASAAS_TEST_CPF_CNPJ') },
    }),
  });
  check(checkout.response.status === 201 || checkout.response.status === 202, `Checkout Sandbox é criado (HTTP ${checkout.response.status})`);
  if (checkout.response.status === 201) {
    const checkoutUrl = String(checkout.body.checkoutUrl || '');
    check(/^https:\/\/([a-z0-9-]+\.)*asaas\.com(\.br)?\//i.test(checkoutUrl), 'URL retornada pertence ao domínio Asaas');
    console.log(`INFO  checkoutId=${String(checkout.body.checkoutId || 'indisponível')}`);
    console.log(`INFO  checkoutUrl=${checkoutUrl}`);
  } else {
    check(typeof checkout.body.checkoutId === 'string', 'boleto pendente devolve checkoutId para reconciliação');
  }
  console.log('OK    smoke Sandbox concluído; pagamento/webhook/ativação ainda exigem a etapa manual de homologação.');
};

main().catch(error => {
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
