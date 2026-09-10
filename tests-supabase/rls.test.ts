import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!anonKey || !serviceRoleKey) throw new Error('Defina SUPABASE_ANON_KEY/VITE_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY para executar os testes RLS.');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Rls-${suffix}-Strong!`;
const identities = [
  { key: 'lawyerA', email: `rls-lawyer-a-${suffix}@example.test`, role: 'lawyer' },
  { key: 'readA', email: `rls-read-a-${suffix}@example.test`, role: 'read' },
  { key: 'lawyerB', email: `rls-lawyer-b-${suffix}@example.test`, role: 'lawyer' },
] as const;
const users = new Map<string, string>();
const offices = new Map<string, string>();
const clients = new Map<string, SupabaseClient>();

const createIdentity = async (identity: typeof identities[number]) => {
  const { data, error } = await admin.auth.admin.createUser({ email: identity.email, password, email_confirm: true });
  if (error || !data.user) throw error || new Error(`Não foi possível criar ${identity.key}.`);
  users.set(identity.key, data.user.id);
  return data.user.id;
};

before(async () => {
  for (const identity of identities) await createIdentity(identity);
  const lawyerA = users.get('lawyerA')!; const lawyerB = users.get('lawyerB')!;
  const readA = users.get('readA')!;
  const profiles = identities.map(identity => ({ id: users.get(identity.key)!, name: identity.key, email: identity.email, role: identity.role }));
  const { error: profileError } = await admin.from('profiles').insert(profiles);
  if (profileError) throw profileError;
  const officeRows = [
    { name: `RLS Office A ${suffix}`, lawyer_name: 'Lawyer A', email: identities[0].email, owner_user_id: lawyerA },
    { name: `RLS Office B ${suffix}`, lawyer_name: 'Lawyer B', email: identities[2].email, owner_user_id: lawyerB },
  ];
  const { data: officeData, error: officeError } = await admin.from('offices').insert(officeRows).select('id');
  if (officeError || !officeData || officeData.length !== 2) throw officeError || new Error('Escritórios RLS não criados.');
  offices.set('officeA', officeData[0].id); offices.set('officeB', officeData[1].id);
  const { error: membershipError } = await admin.from('memberships').insert([
    { office_id: offices.get('officeA'), user_id: lawyerA, email: identities[0].email, name: 'Lawyer A', role: 'lawyer', status: 'active' },
    { office_id: offices.get('officeA'), user_id: readA, email: identities[1].email, name: 'Read A', role: 'read', status: 'active' },
    { office_id: offices.get('officeB'), user_id: lawyerB, email: identities[2].email, name: 'Lawyer B', role: 'lawyer', status: 'active' },
  ]);
  if (membershipError) throw membershipError;
  const { error: officeProfileError } = await admin.from('profiles').update({ office_id: offices.get('officeA') }).in('id', [lawyerA, readA]);
  if (officeProfileError) throw officeProfileError;
  const { error: officeBProfileError } = await admin.from('profiles').update({ office_id: offices.get('officeB') }).eq('id', lawyerB);
  if (officeBProfileError) throw officeBProfileError;
  const { error: leadError } = await admin.from('leads').insert([
    { office_id: offices.get('officeA'), name: 'Lead A', phone: '5511999990001' },
    { office_id: offices.get('officeB'), name: 'Lead B', phone: '5511999990002' },
  ]);
  if (leadError) throw leadError;
  for (const identity of identities) {
    const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email: identity.email, password });
    if (error) throw error;
    clients.set(identity.key, client);
  }
});

after(async () => {
  for (const officeId of offices.values()) await admin.from('offices').delete().eq('id', officeId);
  for (const userId of users.values()) await admin.auth.admin.deleteUser(userId);
});

test('membro lê somente leads do próprio escritório', async () => {
  const client = clients.get('lawyerA')!;
  const own = await client.from('leads').select('id').eq('name', 'Lead A');
  const foreign = await client.from('leads').select('id').eq('name', 'Lead B');
  assert.equal(own.error, null); assert.equal(own.data?.length, 1);
  assert.equal(foreign.error, null); assert.equal(foreign.data?.length, 0);
});

test('papel lawyer pode criar lead e papel read não pode', async () => {
  const lawyer = clients.get('lawyerA')!; const reader = clients.get('readA')!;
  const allowed = await lawyer.from('leads').insert({ office_id: offices.get('officeA'), name: 'Lead criado', phone: '5511999990003' });
  const denied = await reader.from('leads').insert({ office_id: offices.get('officeA'), name: 'Lead negado', phone: '5511999990004' });
  assert.equal(allowed.error, null);
  assert.ok(denied.error);
});

test('outbox de sincronização não é acessível pelo cliente', async () => {
  const client = clients.get('lawyerA')!;
  const result = await client.from('calendar_sync_outbox').select('id');
  assert.equal(result.error, null);
  assert.equal(result.data?.length, 0);
});

test('membro bloqueado perde acesso ao próprio tenant', async () => {
  const userId = users.get('lawyerA')!; const officeId = offices.get('officeA')!;
  const { error } = await admin.from('memberships').update({ status: 'blocked' }).eq('user_id', userId).eq('office_id', officeId);
  if (error) throw error;
  const result = await clients.get('lawyerA')!.from('leads').select('id');
  assert.equal(result.error, null); assert.equal(result.data?.length, 0);
});
