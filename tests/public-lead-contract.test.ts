import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260915000400_public_lead_creation_contract.sql');
const service = read('src/services/supabaseDb.ts');
const publicContactForm = read('src/components/PublicContactForm.tsx');
const leadSchema = read('supabase/migrations/20260909000100_initial_core.sql');

test('RPC de criação aceita somente o payload público e retorna confirmação mínima', () => {
  assert.match(migration, /create or replace function public\.create_public_lead\(/);
  for (const field of [
    'requested_slug', 'lead_name', 'lead_phone', 'lead_email', 'lead_city',
    'lead_state', 'lead_area', 'lead_summary', 'lead_consent_lgpd', 'lead_source',
    'lead_utm_source', 'lead_utm_medium', 'lead_utm_campaign',
  ]) assert.match(migration, new RegExp(`\\b${field}\\b`));
  for (const forbidden of [
    'office_id text', 'role', 'metadata', 'internal_status',
    'lead_status', 'lead_priority', 'lead_notes', 'created_by',
  ]) assert.doesNotMatch(migration, new RegExp(forbidden));
  const signature = migration.match(/create or replace function public\.create_public_lead\(([\s\S]*?)\)\s*returns/)?.[1] ?? '';
  assert.doesNotMatch(signature, /office_id|responsible_user_id|role|metadata|status|priority/i);
  assert.match(migration, /returns table \(\s*lead_id uuid,\s*success boolean/s);
});

test('RPC deriva o tenant pelo slug ativo e define campos administrativos no servidor', () => {
  assert.match(migration, /from public\.public_forms as f[\s\S]*f\.slug = normalized_slug[\s\S]*f\.is_active = true/);
  assert.match(migration, /derived_office_id/);
  assert.match(migration, /insert into public\.leads/);
  assert.match(migration, /derived_office_id,[\s\S]*'Novo contato',[\s\S]*'Média',[\s\S]*null,[\s\S]*'',[\s\S]*'public_form'/);
  assert.match(migration, /public_form_slug/);
  assert.match(migration, /if derived_office_id is null/);
  assert.match(migration, /lead_consent_lgpd is not true/);
});

test('RPC valida slug, campos obrigatórios, área, origem e UTM no servidor', () => {
  assert.match(migration, /length\(normalized_slug\) not between 1 and 120/);
  assert.match(migration, /normalized_phone !~ '\^\[0-9\]\{10,15\}\$'/);
  assert.match(migration, /normalized_state !~ '\^\[A-Z\]\{2\}\$'/);
  assert.match(migration, /normalized_area not in/);
  assert.match(migration, /normalized_source not in/);
  assert.match(migration, /normalized_utm_campaign/);
});

test('RPC não libera INSERT anon direto e mantém CRUD autenticado existente', () => {
  assert.match(migration, /revoke all on function public\.create_public_lead\(/);
  assert.match(migration, /grant execute on function public\.create_public_lead\([\s\S]*\) to anon, authenticated/);
  assert.doesNotMatch(migration, /create policy .*leads.*to anon/i);
  assert.match(leadSchema, /create policy leads_operator_write on public\.leads for all to authenticated/);
});

test('createPublicLead usa exclusivamente a RPC e normaliza erros', () => {
  const publicLeadService = service.match(/export const createPublicLead[\s\S]*?(?=export const getClientPortalAccessByToken)/)?.[0] ?? '';
  assert.match(publicLeadService, /export const createPublicLead = async \(lead: PublicLeadInput\): Promise<string>/);
  assert.match(publicLeadService, /supabase\.rpc\('create_public_lead'/);
  assert.doesNotMatch(publicLeadService, /from\('leads'\)\.insert/);
  assert.match(publicLeadService, /throw new Error\('public_lead_creation_failed'\)/);
});

test('frontend envia slug e campos públicos, sem autoridade administrativa', () => {
  assert.match(publicContactForm, /const publicPayload: PublicLeadInput/);
  assert.match(publicContactForm, /slug: officeSlug/);
  assert.match(publicContactForm, /source: source as PublicLeadInput\['source'\]/);
  assert.match(publicContactForm, /publicPayload\.utmSource/);
  for (const forbidden of ['officeId:', 'status:', 'priority:', 'createdVia:', 'publicFormSlug:', 'responsibleUserId:', 'notes:']) {
    assert.doesNotMatch(publicContactForm, new RegExp(forbidden));
  }
  assert.match(publicContactForm, /await createPublicLead\(publicPayload\)/);
});

test('não há evento público arbitrário neste gate', () => {
  assert.doesNotMatch(migration, /insert into public\.lead_events/);
  assert.doesNotMatch(migration, /lead_event/);
});
