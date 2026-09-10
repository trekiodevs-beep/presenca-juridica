import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!anonKey || !serviceRoleKey) throw new Error('Defina as chaves do Supabase local para executar os testes de documentos.');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const localDownloadUrl = (value: string) => {
  const parsed = new URL(value);
  return parsed.hostname === 'kong' || parsed.hostname === 'supabase' ? `${url}${parsed.pathname}${parsed.search}` : value;
};
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Documents-${suffix}-Strong!`;
const users = new Map<string, { id: string; email: string; client?: SupabaseClient }>();
let officeA = ''; let officeB = ''; let leadA = ''; let documentId = ''; let storagePath = ''; let portalToken = '';

const createIdentity = async (key: string) => {
  const email = `documents-${key}-${suffix}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error || new Error(`Usuário ${key} não criado.`);
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw session.error || new Error(`Sessão ${key} não criada.`);
  users.set(key, { id: data.user.id, email, client });
};

before(async () => {
  await createIdentity('a'); await createIdentity('b');
  const a = users.get('a')!; const b = users.get('b')!;
  const { error: profileError } = await admin.from('profiles').insert([
    { id: a.id, name: 'Documents A', email: a.email, role: 'lawyer' },
    { id: b.id, name: 'Documents B', email: b.email, role: 'lawyer' },
  ]);
  if (profileError) throw profileError;
  const { data: offices, error: officeError } = await admin.from('offices').insert([
    { name: `Documents A ${suffix}`, lawyer_name: 'A', email: a.email, owner_user_id: a.id },
    { name: `Documents B ${suffix}`, lawyer_name: 'B', email: b.email, owner_user_id: b.id },
  ]).select('id');
  if (officeError || !offices || offices.length !== 2) throw officeError || new Error('Escritórios de documentos não criados.');
  officeA = offices[0].id; officeB = offices[1].id;
  const { error: membershipError } = await admin.from('memberships').insert([
    { office_id: officeA, user_id: a.id, email: a.email, name: 'A', role: 'lawyer', status: 'active' },
    { office_id: officeB, user_id: b.id, email: b.email, name: 'B', role: 'lawyer', status: 'active' },
  ]);
  if (membershipError) throw membershipError;
  await admin.from('profiles').update({ office_id: officeA }).eq('id', a.id);
  await admin.from('profiles').update({ office_id: officeB }).eq('id', b.id);
  const { data: lead, error: leadError } = await admin.from('leads').insert({ office_id: officeA, name: 'Cliente documento', phone: '5511999990101' }).select('id').single();
  if (leadError || !lead) throw leadError || new Error('Lead de documento não criado.');
  leadA = lead.id;
  storagePath = `${officeA}/${leadA}/${crypto.randomUUID()}-evidence.txt`;
  const upload = await a.client!.storage.from('lead-documents').upload(storagePath, new Blob(['documento de teste']), { contentType: 'text/plain', upsert: false });
  if (upload.error) throw upload.error;
  const { data: document, error: documentError } = await a.client!.from('lead_documents').insert({ office_id: officeA, lead_id: leadA, name: 'evidence.txt', file_name: 'evidence.txt', content_type: 'text/plain', size: 17, storage_path: storagePath, category: 'Outro', visible_in_portal: true, uploaded_by: a.id }).select('id').single();
  if (documentError || !document) throw documentError || new Error('Documento não criado.');
  documentId = document.id;
  portalToken = `portal-${suffix}`;
  const { error: portalError } = await admin.from('client_portal_access').insert({ id: portalToken, office_id: officeA, lead_id: leadA, client_name: 'Cliente teste', is_active: true, expires_at: new Date(Date.now() + 3600000).toISOString(), documents: [{ id: documentId }] });
  if (portalError) throw portalError;
});

after(async () => {
  if (storagePath) await admin.storage.from('lead-documents').remove([storagePath]);
  for (const office of [officeA, officeB]) if (office) await admin.from('offices').delete().eq('id', office);
  for (const user of users.values()) await admin.auth.admin.deleteUser(user.id);
});

test('documento privado permite membro autorizado e bloqueia outro escritório', async () => {
  const allowed = await users.get('a')!.client!.from('lead_documents').select('id').eq('id', documentId);
  const denied = await users.get('b')!.client!.from('lead_documents').select('id').eq('id', documentId);
  assert.equal(allowed.error, null); assert.equal(allowed.data?.length, 1);
  assert.equal(denied.error, null); assert.equal(denied.data?.length, 0);
});

test('download interno gera URL assinada temporária', async () => {
  const result = await users.get('a')!.client!.storage.from('lead-documents').createSignedUrl(storagePath, 300);
  assert.equal(result.error, null); assert.ok(result.data?.signedUrl);
  const response = await fetch(result.data!.signedUrl);
  assert.equal(response.status, 200); assert.equal(await response.text(), 'documento de teste');
});

test('portal gera download somente para token ativo e documento visível', async () => {
  const valid = await fetch(`${url}/functions/v1/portal-document-download`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ portalToken, documentId }) });
  const validBody = await valid.json() as { downloadUrl?: string };
  assert.equal(valid.status, 200); assert.ok(validBody.downloadUrl);
  const downloaded = await fetch(localDownloadUrl(validBody.downloadUrl!));
  assert.equal(downloaded.status, 200); assert.equal(await downloaded.text(), 'documento de teste');
  const invalid = await fetch(`${url}/functions/v1/portal-document-download`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ portalToken: `${portalToken}-invalid`, documentId }) });
  assert.equal(invalid.status, 404);
});
