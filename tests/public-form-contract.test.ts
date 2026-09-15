import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260915000300_public_form_public_contract.sql');
const service = read('src/services/supabaseDb.ts');
const publicFormPage = read('src/pages/PublicForm.tsx');
const officePage = read('src/pages/OfficePublicPage.tsx');
const publicContactForm = read('src/components/PublicContactForm.tsx');
const historicalPolicies = read('supabase/migrations/20260909000400_public_forms_usage.sql');

test('RPC público retorna somente a allowlist usada pelas rotas públicas', () => {
  for (const field of ['slug', 'office_id', 'office_name', 'lawyer_name', 'whatsapp', 'city', 'state', 'areas', 'is_active']) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
  for (const internalField of ['email', 'created_at', 'updated_at']) {
    assert.doesNotMatch(migration, new RegExp(`f\\.${internalField}\\b`));
  }
  assert.match(migration, /f\.is_active\s*=\s*true/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public/);
});

test('RPC público valida slug e é executável sem liberar SELECT anon na tabela', () => {
  assert.match(migration, /length\(trim\(requested_slug\)\) between 1 and 120/);
  assert.match(migration, /\^\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\$/);
  assert.match(migration, /revoke all on function public\.get_public_form_by_slug\(text\) from public/);
  assert.match(migration, /grant execute on function public\.get_public_form_by_slug\(text\) to anon, authenticated/);
  assert.doesNotMatch(historicalPolicies, /create policy .*public_forms.*to anon/i);
  assert.doesNotMatch(migration, /create policy .*public_forms.*to anon/i);
});

test('getPublicFormBySlug usa exclusivamente o contrato RPC', () => {
  assert.match(service, /export const getPublicFormBySlug = async \(slug: string\): Promise<PublicFormPublic \| null>/);
  assert.match(service, /supabase\.rpc\('get_public_form_by_slug', \{ requested_slug: normalizedSlug \}\)/);
  assert.doesNotMatch(service, /getPublicFormBySlug[\s\S]*?from\('public_forms'\)\.select/);
});

test('rotas públicas continuam consumindo o mesmo serviço e tratam ausência como indisponível', () => {
  assert.match(publicFormPage, /getPublicFormBySlug\(normalizedOfficeSlug\)/);
  assert.match(publicFormPage, /if \(!form \|\| form\.isActive !== true\)/);
  assert.match(officePage, /getPublicFormBySlug\(officeSlug\)/);
  assert.match(officePage, /if \(form && form\.isActive\)/);
  assert.doesNotMatch(publicContactForm, /officeForm\.officeId/);
  assert.match(publicContactForm, /officeForm\.officeName/);
  assert.match(publicContactForm, /officeForm\.areas/);
  assert.match(publicContactForm, /officeForm\.whatsapp/);
});

test('este microgate não altera a criação pública de leads', () => {
  assert.match(publicContactForm, /import \{ createPublicLead \} from '\.\.\/services\/supabaseDb'/);
  assert.match(publicContactForm, /await createPublicLead\(publicPayload\)/);
  assert.doesNotMatch(migration, /public\.leads|create policy .*leads/i);
});
