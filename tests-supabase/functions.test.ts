import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!anonKey || !serviceRoleKey) throw new Error('Defina as chaves do Supabase local para executar os testes de Functions.');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Functions-${suffix}-Strong!`;
const identities = {
  owner: { email: `functions-owner-${suffix}@example.test`, id: '' },
  platform: { email: `functions-platform-${suffix}@example.test`, id: '' },
};
let officeId = '';
let ownerToken = '';
let platformToken = '';

const invoke = async (name: string, token: string | undefined, body: Record<string, unknown>) => {
  const response = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data: data as Record<string, unknown> };
};

const createUser = async (email: string) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error || new Error('Usuário local não criado.');
  return data.user.id;
};

const signIn = async (email: string) => {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error || new Error('Sessão local não criada.');
  return data.session.access_token;
};

before(async () => {
  identities.owner.id = await createUser(identities.owner.email);
  identities.platform.id = await createUser(identities.platform.email);
  const { error: profilesError } = await admin.from('profiles').insert([
    { id: identities.owner.id, name: 'Functions Owner', email: identities.owner.email, role: 'owner' },
    { id: identities.platform.id, name: 'Functions Platform', email: identities.platform.email, role: 'admin', global_role: 'platform_admin' },
  ]);
  if (profilesError) throw profilesError;
  const { data: office, error: officeError } = await admin.from('offices').insert({ name: `Functions Office ${suffix}`, lawyer_name: 'Owner', email: identities.owner.email, owner_user_id: identities.owner.id }).select('id').single();
  if (officeError || !office) throw officeError || new Error('Escritório local não criado.');
  officeId = office.id;
  const { error: membershipError } = await admin.from('memberships').insert({ office_id: officeId, user_id: identities.owner.id, email: identities.owner.email, name: 'Functions Owner', role: 'owner', status: 'active' });
  if (membershipError) throw membershipError;
  const { error: profileError } = await admin.from('profiles').update({ office_id: officeId }).eq('id', identities.owner.id);
  if (profileError) throw profileError;
  ownerToken = await signIn(identities.owner.email);
  platformToken = await signIn(identities.platform.email);
});

after(async () => {
  if (officeId) await admin.from('offices').delete().eq('id', officeId);
  for (const identity of Object.values(identities)) if (identity.id) await admin.auth.admin.deleteUser(identity.id);
});

test('support-requests cria chamado autenticado e protocolo LGPD público', async () => {
  const support = await invoke('support-requests', ownerToken, { kind: 'support', subject: 'Falha de sincronização', message: 'A agenda não atualizou o compromisso local.' });
  assert.equal(support.status, 200); assert.ok(support.data.ticketId);
  const privacy = await invoke('support-requests', undefined, { kind: 'privacy', email: 'titular@example.test', requestType: 'access', details: 'Solicito acesso aos dados armazenados.' });
  assert.equal(privacy.status, 200); assert.match(String(privacy.data.protocol), /^PJ-/);
});

test('team-invitations cria e lista convite do escritório', async () => {
  const invited = await invoke('team-invitations', ownerToken, { action: 'invite', email: `invite-${suffix}@example.test`, role: 'assistant' });
  assert.equal(invited.status, 200); assert.match(String(invited.data.invitationUrl), /\/convites\//);
  const listed = await invoke('team-invitations', ownerToken, { action: 'list' });
  assert.equal(listed.status, 200); assert.equal(Array.isArray(listed.data.invitations), true); assert.equal((listed.data.invitations as unknown[]).length, 1);
});

test('privacy-controls exporta e agenda/cancela exclusão', async () => {
  const exported = await invoke('privacy-controls', ownerToken, { action: 'export' });
  assert.equal(exported.status, 200); assert.equal(exported.data.officeId, officeId); assert.ok(exported.data.data);
  const scheduled = await invoke('privacy-controls', ownerToken, { action: 'schedule-deletion' });
  assert.equal(scheduled.status, 200); assert.ok(scheduled.data.deletionScheduledAt);
  const canceled = await invoke('privacy-controls', ownerToken, { action: 'cancel-deletion' });
  assert.equal(canceled.status, 200); assert.equal(canceled.data.canceled, true);
});

test('suporte solicita, aprova e lê diagnóstico temporário', async () => {
  const requested = await invoke('support-access', platformToken, { action: 'request', officeId, reason: 'Investigar falha reportada pelo escritório.' });
  assert.equal(requested.status, 200); const requestId = String(requested.data.requestId);
  const decided = await invoke('support-access', ownerToken, { action: 'decide', requestId, decision: 'approved' });
  assert.equal(decided.status, 200); assert.equal(decided.data.status, 'approved');
  const snapshot = await invoke('support-access', platformToken, { action: 'snapshot', requestId });
  assert.equal(snapshot.status, 200); assert.equal((snapshot.data.office as Record<string, unknown>).id, officeId); assert.ok(snapshot.data.accessExpiresAtMs);
});
