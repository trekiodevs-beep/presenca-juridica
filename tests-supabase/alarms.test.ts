import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!anonKey || !serviceRoleKey) throw new Error('Defina SUPABASE_ANON_KEY/VITE_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY para executar os testes de alarmes.');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Alarm-${suffix}-Strong!`;
const users = new Map<string, string>();
const clients = new Map<string, SupabaseClient>();
let officeId = '';
let foreignOfficeId = '';
let leadId = '';

const createIdentity = async (key: string, role: 'owner' | 'admin' | 'lawyer') => {
  const email = `alarm-${key}-${suffix}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error || new Error(`Usuário ${key} não criado.`);
  users.set(key, created.data.user.id);
  const profile = await admin.from('profiles').insert({ id: created.data.user.id, name: `Alarm ${key}`, email, role }).select('id').single();
  if (profile.error) throw profile.error;
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  clients.set(key, client);
};

before(async () => {
  await createIdentity('owner', 'owner');
  await createIdentity('lawyer', 'lawyer');
  await createIdentity('foreign', 'owner');
  const ownerId = users.get('owner')!;
  const foreignId = users.get('foreign')!;

  const offices = await admin.from('offices').insert([
    { name: `Alarm Office ${suffix}`, lawyer_name: 'Alarm Owner', owner_user_id: ownerId },
    { name: `Foreign Alarm Office ${suffix}`, lawyer_name: 'Foreign Owner', owner_user_id: foreignId },
  ]).select('id');
  if (offices.error || !offices.data || offices.data.length !== 2) throw offices.error || new Error('Escritórios de alarme não criados.');
  officeId = offices.data[0].id;
  foreignOfficeId = offices.data[1].id;

  const memberships = await admin.from('memberships').insert([
    { office_id: officeId, user_id: ownerId, email: `alarm-owner-${suffix}@example.test`, name: 'Alarm Owner', role: 'owner', status: 'active' },
    { office_id: officeId, user_id: users.get('lawyer'), email: `alarm-lawyer-${suffix}@example.test`, name: 'Alarm Lawyer', role: 'lawyer', status: 'active' },
    { office_id: foreignOfficeId, user_id: foreignId, email: `alarm-foreign-${suffix}@example.test`, name: 'Foreign Owner', role: 'owner', status: 'active' },
  ]);
  if (memberships.error) throw memberships.error;

  const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const lead = await admin.from('leads').insert({
    office_id: officeId,
    name: 'Lead de alarme',
    phone: '5511999990000',
    status: 'Novo contato',
    created_at: old,
    next_action_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    next_action_text: 'Retornar contato',
  }).select('id').single();
  if (lead.error || !lead.data) throw lead.error || new Error('Lead de alarme não criado.');
  leadId = lead.data.id;
});

after(async () => {
  for (const id of [officeId, foreignOfficeId]) if (id) await admin.from('offices').delete().eq('id', id);
  for (const id of users.values()) await admin.auth.admin.deleteUser(id);
});

test('avaliador cria alarmes idempotentes e materializa somente destinatários autorizados', async () => {
  const first = await admin.rpc('evaluate_office_operational_alarms', { target_office_id: officeId });
  assert.equal(first.error, null);
  const second = await admin.rpc('evaluate_office_operational_alarms', { target_office_id: officeId });
  assert.equal(second.error, null);

  const alarms = await admin.from('operational_alarms').select('id, rule_code, state').eq('office_id', officeId).order('rule_code');
  assert.equal(alarms.error, null);
  assert.deepEqual(alarms.data?.map(row => row.rule_code), ['LEAD_UNASSIGNED', 'NEXT_ACTION_OVERDUE', 'TRIAGE_OVERDUE']);
  assert.ok(alarms.data?.every(row => row.state === 'OPEN'));

  const recipients = await admin.from('operational_alarm_recipients').select('user_id, delivery_reason').eq('office_id', officeId);
  assert.equal(recipients.error, null);
  assert.equal(new Set(recipients.data?.map(row => row.user_id)).size, 1);
  assert.equal(recipients.data?.[0]?.user_id, users.get('owner'));
});

test('RLS nega escrita direta e isola alarmes por escritório', async () => {
  const owner = clients.get('owner')!;
  const foreign = clients.get('foreign')!;
  const directInsert = await owner.from('operational_alarms').insert({ office_id: officeId, source_type: 'OFFICE', rule_code: 'DIRECT_WRITE', cycle_key: 'direct', severity: 'INFO', title: 'Não deveria inserir' });
  assert.ok(directInsert.error);

  const own = await owner.from('operational_alarms').select('id').eq('office_id', officeId);
  assert.equal(own.error, null);
  assert.equal(own.data?.length, 3);
  const foreignRead = await foreign.from('operational_alarms').select('id').eq('office_id', officeId);
  assert.equal(foreignRead.error, null);
  assert.equal(foreignRead.data?.length, 0);

  const lawyerRead = await clients.get('lawyer')!.from('operational_alarms').select('id').eq('office_id', officeId);
  assert.equal(lawyerRead.error, null);
  assert.equal(lawyerRead.data?.length, 0);
});

test('leitura e snooze são pessoais; reconhecimento usa versão e resolução mantém histórico', async () => {
  const owner = clients.get('owner')!;
  const alarmList = await owner.from('operational_alarms').select('id, version').eq('office_id', officeId).eq('rule_code', 'NEXT_ACTION_OVERDUE').single();
  assert.equal(alarmList.error, null);
  const alarmId = alarmList.data.id;
  const version = Number(alarmList.data.version);

  const marked = await owner.rpc('mark_operational_alarm_read', { target_alarm_id: alarmId });
  assert.equal(marked.error, null);
  const snoozed = await owner.rpc('snooze_operational_alarm_for_me', { target_alarm_id: alarmId, until_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  assert.equal(snoozed.error, null);
  assert.ok(snoozed.data?.snoozed_until);

  const acknowledged = await owner.rpc('acknowledge_operational_alarm', { target_alarm_id: alarmId, expected_version: version });
  assert.equal(acknowledged.error, null);
  assert.equal(acknowledged.data?.state, 'ACKNOWLEDGED');
  const stale = await owner.rpc('resolve_operational_alarm', { target_alarm_id: alarmId, resolution: 'resolved', reason: 'versão antiga', expected_version: version });
  assert.equal(stale.error?.code, 'P0009');

  const resolved = await owner.rpc('resolve_operational_alarm', { target_alarm_id: alarmId, resolution: 'followup_done', reason: 'Providência executada', expected_version: Number(acknowledged.data?.version) });
  assert.equal(resolved.error, null);
  assert.equal(resolved.data?.state, 'RESOLVED');
  const history = await admin.from('operational_alarm_events').select('event_type, from_state, to_state').eq('alarm_id', alarmId).order('created_at');
  assert.equal(history.error, null);
  assert.deepEqual(history.data?.map(row => row.event_type), ['CREATED', 'ACKNOWLEDGED', 'RESOLVED']);
});

test('mudança da origem resolve automaticamente sem depender da Central aberta', async () => {
  const resolvedLead = await admin.from('leads').update({ responsible_user_id: users.get('lawyer'), status: 'Triagem realizada', next_action_at: null }).eq('id', leadId);
  assert.equal(resolvedLead.error, null);
  const evaluated = await admin.rpc('evaluate_office_operational_alarms', { target_office_id: officeId });
  assert.equal(evaluated.error, null);
  const active = await admin.from('operational_alarms').select('rule_code, state').eq('office_id', officeId).in('rule_code', ['LEAD_UNASSIGNED', 'NEXT_ACTION_OVERDUE', 'TRIAGE_OVERDUE']);
  assert.equal(active.error, null);
  assert.ok(active.data?.every(row => row.state === 'RESOLVED'));
});
