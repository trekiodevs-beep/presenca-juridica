import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY para executar os testes de calendário.');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let userId = '';
let officeId = '';
let eventId = '';

before(async () => {
  const email = `calendar-contract-${suffix}@example.test`;
  const user = await admin.auth.admin.createUser({ email, password: `Calendar-${suffix}-Strong!`, email_confirm: true });
  if (user.error || !user.data.user) throw user.error || new Error('Usuário de teste não criado.');
  userId = user.data.user.id;

  const profile = await admin.from('profiles').insert({ id: userId, name: 'Calendar Contract', email }).select('id').single();
  if (profile.error) throw profile.error;
  const office = await admin.from('offices').insert({ name: `Calendar Contract ${suffix}`, lawyer_name: 'Contract', owner_user_id: userId }).select('id').single();
  if (office.error || !office.data) throw office.error || new Error('Escritório de teste não criado.');
  officeId = office.data.id;
  const membership = await admin.from('memberships').insert({ office_id: officeId, user_id: userId, email, name: 'Calendar Contract', role: 'owner', status: 'active' });
  if (membership.error) throw membership.error;
});

after(async () => {
  if (officeId) await admin.from('offices').delete().eq('id', officeId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test('evento cria uma única pendência e alterações reabrem a entrega', async () => {
  const created = await admin.from('calendar_events').insert({
    office_id: officeId,
    title: 'Audiência inicial',
    type: 'Audiência',
    start_at: '2026-09-10T14:00:00Z',
    end_at: '2026-09-10T15:00:00Z',
    sync_status: 'not_connected',
  }).select('id, sync_status').single();
  if (created.error || !created.data) throw created.error || new Error('Evento não criado.');
  eventId = created.data.id;
  const persisted = await admin.from('calendar_events').select('sync_status').eq('id', eventId).single();
  assert.equal(persisted.error, null);
  assert.equal(persisted.data.sync_status, 'pending');

  const firstQueue = await admin.from('calendar_sync_outbox').select('id, status, attempts').eq('calendar_event_id', eventId);
  assert.equal(firstQueue.error, null);
  assert.equal(firstQueue.data?.length, 1);
  assert.equal(firstQueue.data?.[0].status, 'pending');
  assert.equal(firstQueue.data?.[0].attempts, 0);

  const changed = await admin.from('calendar_events').update({ title: 'Audiência inicial atualizada' }).eq('id', eventId);
  assert.equal(changed.error, null);
  const deduplicated = await admin.from('calendar_sync_outbox').select('id, status, attempts').eq('calendar_event_id', eventId);
  assert.equal(deduplicated.data?.length, 1);
  assert.equal(deduplicated.data?.[0].status, 'pending');
});

test('claim bloqueia a mesma pendência e incrementa tentativas', async () => {
  const firstClaim = await admin.rpc('claim_calendar_sync_outbox', { batch_size: 1 });
  assert.equal(firstClaim.error, null);
  assert.equal(firstClaim.data?.length, 1);
  assert.equal(firstClaim.data?.[0].calendar_event_id, eventId);
  assert.equal(firstClaim.data?.[0].status, 'processing');
  assert.equal(firstClaim.data?.[0].attempts, 1);

  const secondClaim = await admin.rpc('claim_calendar_sync_outbox', { batch_size: 1 });
  assert.equal(secondClaim.error, null);
  assert.equal(secondClaim.data?.length, 0);

  const changed = await admin.from('calendar_events').update({ notes: 'Alterado durante processamento' }).eq('id', eventId);
  assert.equal(changed.error, null);
  const reopened = await admin.from('calendar_sync_outbox').select('status, attempts').eq('calendar_event_id', eventId).single();
  assert.equal(reopened.error, null);
  assert.equal(reopened.data.status, 'pending');
  assert.equal(reopened.data.attempts, 1);

  const retryClaim = await admin.rpc('claim_calendar_sync_outbox', { batch_size: 1 });
  assert.equal(retryClaim.error, null);
  assert.equal(retryClaim.data?.length, 1);
  assert.equal(retryClaim.data?.[0].attempts, 2);
});
