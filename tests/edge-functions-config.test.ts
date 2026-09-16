import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const functionsRoot = resolve(process.cwd(), 'supabase', 'functions');
const functionFiles = readdirSync(functionsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== '_shared')
  .map(entry => `${entry.name}/index.ts`);

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), 'supabase', 'functions', relativePath), 'utf8');

test('No Edge Function accepts the removed BACKEND_SERVICE_ROLE_KEY override', () => {
  for (const file of functionFiles) {
    const code = source(file);
    assert.doesNotMatch(code, /BACKEND_SERVICE_ROLE_KEY/, `${file} must not accept the removed legacy override`);
  }
});

test('Every privileged Edge Function uses a project-managed backend key', () => {
  for (const file of functionFiles.filter(file => /SUPABASE_SERVICE_ROLE_KEY/.test(source(file)))) {
    const code = source(file);
    assert.match(code, /Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/, `${file} must read the project-managed service role`);
  }
});

test('Calendar OAuth resolves tenant from active membership and does not mask query failures as 412', () => {
  const code = source('calendar-oauth-start/index.ts');

  assert.match(code, /from\('memberships'\)/);
  assert.match(code, /eq\('status', 'active'\)/);
  assert.match(code, /if \(membershipError\)/);
  assert.doesNotMatch(code, /from\('profiles'\)\.select\('office_id'\)/);
});

test('Calendar OAuth callback does not mask database failures as invalid state', () => {
  const callback = source('calendar-oauth-callback/index.ts');
  const start = source('calendar-oauth-start/index.ts');

  assert.match(callback, /error: stateError/);
  assert.match(callback, /if \(stateError\)/);
  assert.match(callback, /const redirect = \(result: string\) => new Response/);
  assert.match(callback, /return redirect\('server_error'\)/);
  assert.match(callback, /openidconnect\.googleapis\.com\/v1\/userinfo/);
  assert.match(start, /scope: 'openid email /);
});

test('Manual Calendar sync resolves tenant and connection deterministically', () => {
  const code = source('calendar-sync-now/index.ts');

  assert.match(code, /error: membershipError/);
  assert.match(code, /if \(membershipError\)/);
  assert.match(code, /order\('created_at', \{ ascending: true \}\)/);
  assert.match(code, /limit\(1\)/);
  assert.match(code, /error: connectionError/);
  assert.match(code, /eq\('user_id', auth\.user\.id\)[\s\S]*eq\('provider', 'google'\)/);
  assert.match(code, /calendar-sync-now downstream returned non-success/);
});

test('Calendar list and selection are tenant-scoped and preserve database errors', () => {
  for (const file of ['calendar-list/index.ts', 'calendar-select/index.ts']) {
    const code = source(file);
    assert.match(code, /from\('memberships'\)/, `${file} must resolve the active office`);
    assert.match(code, /error: membershipError/, `${file} must preserve membership query errors`);
    assert.match(code, /eq\('office_id', membership\.office_id\)/, `${file} must scope the connection by office`);
    assert.match(code, /eq\('user_id', authData\.user\.id\)/, `${file} must scope the connection by user`);
  }
  assert.match(source('calendar-list/index.ts'), /google_reauthorization_required/);
  assert.match(source('calendar-select/index.ts'), /syncQueued: !enqueueError/);
});

test('Bidirectional Calendar sync registers push delivery and protects concurrent Google edits', () => {
  const selection = source('calendar-select/index.ts');
  const webhook = source('calendar-webhook/index.ts');
  const worker = source('calendar-sync-worker/index.ts');
  const reconcile = source('calendar-reconcile/index.ts');

  assert.match(selection, /events\/watch/);
  assert.match(selection, /crypto\.randomUUID\(\)/);
  assert.match(selection, /webhook_resource_id/);
  assert.match(webhook, /calendar-reconcile/);
  assert.match(webhook, /x-calendar-worker-secret/);
  assert.match(worker, /'if-match'/);
  assert.match(worker, /response\.status === 412/);
  assert.match(reconcile, /response\.status === 410/);
  assert.match(reconcile, /nextSyncToken/);
});

test('Calendar connection status distinguishes missing authentication from server configuration', () => {
  const code = source('calendar-connection-status/index.ts');
  const authenticationCheck = code.indexOf("if (!authorization) return jsonWithCors(request, { error: 'Autenticação obrigatória.' }, 401)");
  const configurationCheck = code.indexOf('if (!supabaseUrl || !anonKey || !serviceRoleKey)');

  assert.notEqual(authenticationCheck, -1);
  assert.notEqual(configurationCheck, -1);
  assert.ok(authenticationCheck < configurationCheck);
});

test('Team invitations answers preflight and applies CORS to every JSON response', () => {
  const code = source('team-invitations/index.ts');

  assert.match(code, /import \{ handleCors, jsonWithCors \} from '\.\.\/_shared\/cors\.ts'/);
  assert.match(code, /const corsResponse = handleCors\(request\)/);
  assert.match(code, /if \(corsResponse\) return corsResponse/);
  assert.match(code, /jsonWithCors\(request, body, status/);
  assert.doesNotMatch(code, /Response\.json/);
});

test('Owner membership repair is scoped and office creation remains idempotent', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase', 'migrations', '20260914000100_repair_owner_memberships.sql'),
    'utf8',
  );

  assert.match(migration, /office\.owner_user_id/);
  assert.match(migration, /on conflict \(office_id, user_id\) do update/);
  assert.match(migration, /membership\.user_id = auth\.uid\(\) and membership\.status = 'active'/);
  assert.match(migration, /if existing_office\.id is not null then/);
  assert.doesNotMatch(migration, /update public\.memberships[\s\S]*where status = 'invited'/);
});

test('Calendar outbox is enqueued only after its parent event exists', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase', 'migrations', '20260914000200_fix_calendar_sync_enqueue_order.sql'),
    'utf8',
  );

  assert.match(migration, /create trigger calendar_events_prepare_sync\s+before insert or update/i);
  assert.match(migration, /create trigger calendar_events_enqueue_sync\s+after insert or update/i);
  assert.match(migration, /execute function public\.prepare_calendar_event_sync\(\)/);
  assert.match(migration, /execute function public\.enqueue_calendar_sync\(\)/);
  assert.doesNotMatch(migration, /create trigger calendar_events_enqueue_sync\s+before insert/i);

  const pendingStatusFix = readFileSync(
    resolve(process.cwd(), 'supabase', 'migrations', '20260915000200_fix_calendar_pending_status.sql'),
    'utf8',
  );
  assert.match(pendingStatusFix, /update public\.calendar_events\s+set sync_status = 'pending', sync_error = null/i);
  assert.match(pendingStatusFix, /sync_status is distinct from 'pending'/i);
});
