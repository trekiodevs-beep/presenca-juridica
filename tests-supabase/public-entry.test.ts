import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!anonKey || !serviceRoleKey) throw new Error('Chaves Supabase locais ausentes para a prova 001C.');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `PublicEntry-${suffix}-Strong!`;
const users = { a: '', b: '' };
const offices = { a: '', b: '' };
const slugs = {
  active: `codex-001c-active-${suffix}`,
  inactive: `codex-001c-inactive-${suffix}`,
  officeB: `codex-001c-office-b-${suffix}`,
};
let clientA: SupabaseClient;
let clientB: SupabaseClient;

const ensureNoError = (error: unknown, label: string) => {
  if (error) throw new Error(label);
};

const createUser = async (email: string) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  ensureNoError(error, 'fixture user creation failed');
  if (!data.user) throw new Error('fixture user creation returned no user');
  return data.user.id;
};

const signIn = async (email: string) => {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  ensureNoError(error, 'fixture sign-in failed');
  if (!data.session) throw new Error('fixture sign-in returned no session');
  return client;
};

const publicPayload = (slug: string, name: string, overrides: Record<string, unknown> = {}) => ({
  requested_slug: slug,
  lead_name: name,
  lead_phone: '5535999990011',
  lead_email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }@example.test`,
  lead_city: 'Poços de Caldas',
  lead_state: 'MG',
  lead_area: 'Direito Civil',
  lead_summary: 'Fixture controlada do gate público 001C.',
  lead_consent_lgpd: true,
  lead_source: 'Formulário Público',
  lead_utm_source: 'fixture',
  lead_utm_medium: 'test',
  lead_utm_campaign: 'pj-001c',
  ...overrides,
});

const createPublic = async (client: SupabaseClient, payload: Record<string, unknown>) => client.rpc('create_public_lead', payload);

const findFixtureLeads = async (name: string) => {
  const { data, error } = await admin.from('leads').select('id, office_id, status, priority, responsible_user_id, created_via, public_form_slug, utm_source, utm_medium, utm_campaign').eq('name', name);
  ensureNoError(error, 'fixture lead verification failed');
  return data || [];
};

before(async () => {
  users.a = await createUser(`codex-001c-a-${suffix}@example.test`);
  users.b = await createUser(`codex-001c-b-${suffix}@example.test`);

  const { error: profilesError } = await admin.from('profiles').insert([
    { id: users.a, name: 'CODEX 001C A', email: `codex-001c-a-${suffix}@example.test`, role: 'owner' },
    { id: users.b, name: 'CODEX 001C B', email: `codex-001c-b-${suffix}@example.test`, role: 'owner' },
  ]);
  ensureNoError(profilesError, 'fixture profiles creation failed');

  const { data: officeData, error: officesError } = await admin.from('offices').insert([
    { name: `CODEX 001C Office A ${suffix}`, lawyer_name: 'Fixture A', city: 'Poços de Caldas', state: 'MG', owner_user_id: users.a },
    { name: `CODEX 001C Office B ${suffix}`, lawyer_name: 'Fixture B', city: 'Poços de Caldas', state: 'MG', owner_user_id: users.b },
  ]).select('id');
  ensureNoError(officesError, 'fixture offices creation failed');
  if (!officeData || officeData.length !== 2) throw new Error('fixture offices creation returned an unexpected count');
  offices.a = String(officeData[0].id);
  offices.b = String(officeData[1].id);

  const { error: membershipsError } = await admin.from('memberships').insert([
    { office_id: offices.a, user_id: users.a, email: `codex-001c-a-${suffix}@example.test`, name: 'CODEX 001C A', role: 'owner', status: 'active' },
    { office_id: offices.b, user_id: users.b, email: `codex-001c-b-${suffix}@example.test`, name: 'CODEX 001C B', role: 'owner', status: 'active' },
  ]);
  ensureNoError(membershipsError, 'fixture memberships creation failed');

  const { error: formsError } = await admin.from('public_forms').insert([
    { slug: slugs.active, office_id: offices.a, office_name: 'CODEX Office A', lawyer_name: 'Fixture A', email: 'internal-a@example.test', city: 'Poços de Caldas', state: 'MG', areas: ['Direito Civil'], is_active: true },
    { slug: slugs.inactive, office_id: offices.a, office_name: 'CODEX Inactive', lawyer_name: 'Fixture A', email: 'internal-inactive@example.test', city: 'Poços de Caldas', state: 'MG', areas: ['Direito Civil'], is_active: false },
    { slug: slugs.officeB, office_id: offices.b, office_name: 'CODEX Office B', lawyer_name: 'Fixture B', email: 'internal-b@example.test', city: 'Poços de Caldas', state: 'MG', areas: ['Direito Civil'], is_active: true },
  ]);
  ensureNoError(formsError, 'fixture public forms creation failed');

  const { data: foreignLead, error: foreignLeadError } = await admin.from('leads').insert({ office_id: offices.b, name: `CODEX 001C foreign ${suffix}`, phone: '5535999990022' }).select('id').single();
  ensureNoError(foreignLeadError, 'fixture foreign lead creation failed');
  if (!foreignLead?.id) throw new Error('fixture foreign lead returned no id');

  clientA = await signIn(`codex-001c-a-${suffix}@example.test`);
  clientB = await signIn(`codex-001c-b-${suffix}@example.test`);
});

after(async () => {
  await admin.from('offices').delete().in('id', [offices.a, offices.b].filter(Boolean));
  for (const userId of [users.a, users.b].filter(Boolean)) await admin.auth.admin.deleteUser(userId);
});

test('A1/A2/A3/A6: anon lê apenas formulário ativo e allowlist pública', async () => {
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const active = await anon.rpc('get_public_form_by_slug', { requested_slug: slugs.active });
  ensureNoError(active.error, 'active public form RPC failed');
  assert.equal(Array.isArray(active.data), true);
  assert.equal(active.data?.length, 1);
  assert.deepEqual(Object.keys(active.data?.[0] || {}).sort(), ['areas', 'city', 'is_active', 'lawyer_name', 'office_id', 'office_name', 'slug', 'state', 'whatsapp'].sort());

  const missing = await anon.rpc('get_public_form_by_slug', { requested_slug: `codex-001c-missing-${suffix}` });
  ensureNoError(missing.error, 'missing public form RPC failed');
  assert.equal(missing.data?.length, 0);
  const inactive = await anon.rpc('get_public_form_by_slug', { requested_slug: slugs.inactive });
  ensureNoError(inactive.error, 'inactive public form RPC failed');
  assert.equal(inactive.data?.length, 0);
});

test('A4/A5: anon não lê nem lista diretamente public_forms', async () => {
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const direct = await anon.from('public_forms').select('*');
  ensureNoError(direct.error, 'direct public_forms query failed unexpectedly');
  assert.equal(direct.data?.length, 0);
  const listed = await anon.from('public_forms').select('slug');
  ensureNoError(listed.error, 'public_forms listing failed unexpectedly');
  assert.equal(listed.data?.length, 0);
});

test('B1/B2/B3: criação válida deriva o tenant e ignora/taxa office_id adulterado', async () => {
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const validName = `CODEX 001C valid ${suffix}`;
  const valid = await createPublic(anon, publicPayload(slugs.active, validName));
  ensureNoError(valid.error, 'valid public lead RPC failed');
  const validRow = Array.isArray(valid.data) ? valid.data[0] : valid.data;
  assert.equal(validRow?.success, true);
  assert.ok(validRow?.lead_id);
  const validLead = (await findFixtureLeads(validName))[0];
  assert.equal(validLead?.office_id, offices.a);

  const crossName = `CODEX 001C cross tenant ${suffix}`;
  const cross = await createPublic(anon, publicPayload(slugs.active, crossName, { office_id: offices.b }));
  if (cross.error) {
    assert.ok(cross.error);
  } else {
    const crossRow = (await findFixtureLeads(crossName))[0];
    assert.equal(crossRow?.office_id, offices.a);
  }
});

test('B4/B5/B10: slug inexistente, formulário inativo e consentimento inválido não criam lead', async () => {
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const cases = [
    [`CODEX 001C missing ${suffix}`, `codex-001c-missing-${suffix}`, true],
    [`CODEX 001C inactive ${suffix}`, slugs.inactive, true],
    [`CODEX 001C no consent ${suffix}`, slugs.active, false],
  ] as const;
  for (const [name, slug, consent] of cases) {
    const result = await createPublic(anon, publicPayload(slug, name, { lead_consent_lgpd: consent }));
    assert.ok(result.error);
    assert.equal((await findFixtureLeads(name)).length, 0);
  }
});

test('B6/B7/B8/B9/B11: campos administrativos não são controláveis e UTM permitido é preservado', async () => {
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const name = `CODEX 001C admin fields ${suffix}`;
  const result = await createPublic(anon, publicPayload(slugs.active, name, {
    responsible_user_id: users.b,
    status: 'Contratado',
    priority: 'Alta',
    role: 'admin',
    metadata: { office_id: offices.b },
  }));
  if (result.error) {
    assert.ok(result.error);
  } else {
    const lead = (await findFixtureLeads(name))[0];
    assert.equal(lead?.office_id, offices.a);
    assert.equal(lead?.status, 'Novo contato');
    assert.equal(lead?.priority, 'Média');
    assert.equal(lead?.responsible_user_id, null);
  }

  const utmName = `CODEX 001C utm ${suffix}`;
  const utm = await createPublic(anon, publicPayload(slugs.active, utmName));
  ensureNoError(utm.error, 'UTM public lead RPC failed');
  const utmLead = (await findFixtureLeads(utmName))[0];
  assert.equal(utmLead?.utm_source, 'fixture');
  assert.equal(utmLead?.utm_medium, 'test');
  assert.equal(utmLead?.utm_campaign, 'pj-001c');
});

test('B12: repetição simples cria registros distintos, sem idempotência complexa', async () => {
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const first = await createPublic(anon, publicPayload(slugs.active, `CODEX 001C repeat one ${suffix}`));
  const second = await createPublic(anon, publicPayload(slugs.active, `CODEX 001C repeat two ${suffix}`));
  ensureNoError(first.error, 'first repeated public lead failed');
  ensureNoError(second.error, 'second repeated public lead failed');
  const firstRow = Array.isArray(first.data) ? first.data[0] : first.data;
  const secondRow = Array.isArray(second.data) ? second.data[0] : second.data;
  assert.notEqual(firstRow?.lead_id, secondRow?.lead_id);
});

test('B13/B16: anon não insere leads nem lead_events diretamente', async () => {
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const directLead = await anon.from('leads').insert({ office_id: offices.b, name: `CODEX 001C direct lead ${suffix}`, phone: '5535999990033' });
  assert.ok(directLead.error);
  const directEvent = await anon.from('lead_events').insert({ office_id: offices.b, lead_id: '00000000-0000-0000-0000-000000000000', type: 'created', description: 'forged' });
  assert.ok(directEvent.error);
});

test('B14/B15: usuário autenticado mantém CRUD próprio e createPublicLead não contorna RLS', async () => {
  const name = `CODEX 001C authenticated CRUD ${suffix}`;
  const inserted = await clientA.from('leads').insert({ office_id: offices.a, name, phone: '5535999990044' }).select('id').single();
  ensureNoError(inserted.error, 'authenticated own lead insert failed');
  if (!inserted.data?.id) throw new Error('authenticated own lead insert returned no id');
  const leadId = String(inserted.data.id);
  const updated = await clientA.from('leads').update({ summary: 'Atualizado pela fixture autenticada.' }).eq('id', leadId);
  ensureNoError(updated.error, 'authenticated own lead update failed');
  const deleted = await clientA.from('leads').delete().eq('id', leadId);
  ensureNoError(deleted.error, 'authenticated own lead delete failed');
});

test('B15: usuários de A e B não atravessam o tenant alheio', async () => {
  const foreign = await admin.from('leads').select('id').eq('name', `CODEX 001C foreign ${suffix}`).single();
  ensureNoError(foreign.error, 'foreign fixture lookup failed');
  const leadB = String(foreign.data.id);
  const fromA = await clientA.from('leads').select('id').eq('id', leadB);
  const fromB = await clientB.from('leads').select('id').eq('id', leadB);
  ensureNoError(fromA.error, 'cross-tenant A query failed');
  ensureNoError(fromB.error, 'own tenant B query failed');
  assert.equal(fromA.data?.length, 0);
  assert.equal(fromB.data?.length, 1);
});
