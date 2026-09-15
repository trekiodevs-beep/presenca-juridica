import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const functionFiles = [
  'alarm-evaluator/index.ts',
  'calendar-connection-status/index.ts',
  'calendar-list/index.ts',
  'calendar-oauth-callback/index.ts',
  'calendar-oauth-start/index.ts',
  'calendar-reconcile/index.ts',
  'calendar-select/index.ts',
  'calendar-sync-now/index.ts',
  'calendar-sync-worker/index.ts',
  'calendar-webhook/index.ts',
  'platform-admin/index.ts',
  'portal-document-download/index.ts',
  'privacy-controls/index.ts',
  'support-access/index.ts',
  'support-requests/index.ts',
  'team-invitations/index.ts',
];

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), 'supabase', 'functions', relativePath), 'utf8');

test('Edge Functions prefer the project-managed service role over a legacy override', () => {
  for (const file of functionFiles) {
    const code = source(file);
    const managedKey = code.indexOf("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    const legacyKey = code.indexOf("Deno.env.get('BACKEND_SERVICE_ROLE_KEY')");

    assert.notEqual(managedKey, -1, `${file} must read SUPABASE_SERVICE_ROLE_KEY`);
    assert.notEqual(legacyKey, -1, `${file} must retain BACKEND_SERVICE_ROLE_KEY as a local fallback`);
    assert.ok(managedKey < legacyKey, `${file} must not let a stale legacy key override the project-managed key`);
  }
});

test('Calendar OAuth resolves tenant from active membership and does not mask query failures as 412', () => {
  const code = source('calendar-oauth-start/index.ts');

  assert.match(code, /from\('memberships'\)/);
  assert.match(code, /eq\('status', 'active'\)/);
  assert.match(code, /if \(membershipError\)/);
  assert.doesNotMatch(code, /from\('profiles'\)\.select\('office_id'\)/);
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
