import assert from 'node:assert/strict';

const base = (process.env.ASAAS_FUNCTION_BASE_URL || `${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/functions/v1`).replace(/\/$/, '');
const endpoint = `${base}/billing-webhook`;

const call = async (headers: Record<string, string>, body: unknown) => {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return response;
};

const main = async () => {
  if (!process.env.ASAAS_WEBHOOK_TOKEN) throw new Error('Defina ASAAS_WEBHOOK_TOKEN somente no ambiente local do teste.');
  const unauthorized = await call({}, { id: 'probe-unauthorized', event: 'CHECKOUT_CREATED' });
  assert.equal(unauthorized.status, 401, `token ausente deve responder 401 (recebido ${unauthorized.status})`);
  console.log('PASS  webhook rejeita token ausente');

  const wrongToken = await call({ 'asaas-access-token': 'wrong-token' }, { id: 'probe-wrong-token', event: 'CHECKOUT_CREATED' });
  assert.equal(wrongToken.status, 401, `token incorreto deve responder 401 (recebido ${wrongToken.status})`);
  console.log('PASS  webhook rejeita token incorreto');

  const malformed = await call({ 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN }, { id: 'probe-malformed' });
  assert.equal(malformed.status, 400, `payload sem event deve responder 400 (recebido ${malformed.status})`);
  console.log('PASS  webhook rejeita payload sem contrato mínimo');
  console.log('OK    probe público concluído; nenhum evento válido foi enviado e nenhuma mutação de cobrança foi solicitada.');
};

main().catch(error => {
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
