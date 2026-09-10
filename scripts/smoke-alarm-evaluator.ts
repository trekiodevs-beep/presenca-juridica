const baseUrl = process.env.ALARM_EVALUATOR_URL || 'http://127.0.0.1:54321/functions/v1/alarm-evaluator';
const secret = process.env.ALARM_EVALUATOR_SECRET;
if (!secret) throw new Error('Defina ALARM_EVALUATOR_SECRET para executar o smoke test.');

const officeId = process.env.ALARM_EVALUATOR_OFFICE_ID;
const target = officeId ? `${baseUrl}?office_id=${encodeURIComponent(officeId)}` : baseUrl;
let lastError = '';
for (let attempt = 1; attempt <= 10; attempt += 1) {
  try {
    const response = await fetch(target, { method: 'POST', headers: { 'x-alarm-evaluator-secret': secret } });
    const body = await response.text();
    if (response.ok) { console.log(body); process.exit(0); }
    lastError = `Evaluator HTTP ${response.status}: ${body}`;
    if (response.status !== 404) break;
  } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
throw new Error(lastError || 'Evaluator indisponível.');
