import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('core mutations update optimistically and restore the previous entity on failure', () => {
  const context = source('src/context/DataContext.tsx');
  for (const entity of ['leads', 'tasks', 'calendarEvents', 'financialRecords']) {
    const pascalEntity = entity[0].toUpperCase() + entity.slice(1);
    assert.match(context, new RegExp(`const previous = ${entity}\\.find`), `${entity} must capture its previous value`);
    assert.match(context, new RegExp(`set${pascalEntity}\\(current => current\\.map`), `${entity} must update through a functional setter`);
    assert.match(context, new RegExp(`set${pascalEntity}\\(current => current\\.map\\([^;]+previous`), `${entity} must restore its previous value`);
  }
});

test('realtime listener has error recovery, visible polling and complete cleanup', () => {
  const database = source('src/services/supabaseDb.ts');
  assert.match(database, /CHANNEL_ERROR/);
  assert.match(database, /TIMED_OUT/);
  assert.match(database, /CLOSED/);
  assert.match(database, /document\.visibilityState === 'visible'/);
  assert.match(database, /setInterval\([\s\S]*60000/);
  assert.match(database, /removeEventListener\('visibilitychange'/);
  assert.match(database, /removeChannel\(channel\)/);
});

test('core realtime migration publishes every synchronized entity idempotently', () => {
  const migration = source('supabase/migrations/20260915000100_core_realtime.sql');
  for (const table of ['leads', 'tasks', 'calendar_events', 'financial_records']) assert.match(migration, new RegExp(`'${table}'`));
  assert.match(migration, /pg_publication_tables/);
  assert.match(migration, /not exists/);
  assert.match(migration, /alter publication supabase_realtime add table/);
});

test('application source does not use blocking browser alert, confirm or prompt dialogs', () => {
  const files = [
    'src/pages/Admin.tsx', 'src/pages/Agenda.tsx', 'src/pages/Billing.tsx', 'src/pages/Privacy.tsx',
    'src/pages/PublicClientPortal.tsx', 'src/pages/Security.tsx', 'src/pages/Team.tsx',
    'src/components/PublicContactForm.tsx', 'src/components/leads/KanbanBoard.tsx',
  ];
  for (const file of files) assert.doesNotMatch(source(file), /(?:window\.)?(?:alert|confirm|prompt)\s*\(/, `${file} must use an accessible in-app response`);
});

test('Calendar sync never renders the raw Edge Function SDK error to the customer', () => {
  const agenda = source('src/pages/Agenda.tsx');
  const databaseService = source('src/services/supabaseDb.ts');

  assert.match(agenda, /error instanceof CalendarSyncRequestError/);
  assert.doesNotMatch(agenda, /setSyncMessage\(error instanceof Error \? error\.message/);
  assert.match(databaseService, /error instanceof FunctionsHttpError/);
  assert.match(databaseService, /error\.context\.clone\(\)\.json\(\)/);
  assert.match(databaseService, /Não foi possível sincronizar a agenda agora\. Tente novamente\./);
});

test('Google Calendar settings translates function failures into actionable customer messages', () => {
  const settings = source('src/pages/Settings.tsx');
  const databaseService = source('src/services/supabaseDb.ts');

  assert.match(settings, /error instanceof GoogleCalendarSettingsError/);
  assert.doesNotMatch(settings, /if \(error\) throw error;[\s\S]*Não foi possível listar as agendas Google/);
  assert.match(databaseService, /code === 'google_reauthorization_required'/);
  assert.match(databaseService, /Use “Reconectar Google Agenda”/);
  assert.match(settings, /Nenhuma agenda disponível para sincronização foi encontrada/);
});

test('Calendar synchronization messages use CRM terminology instead of infrastructure jargon', () => {
  const agendaPage = source('src/pages/Agenda.tsx');
  const settingsPage = source('src/pages/Settings.tsx');

  assert.doesNotMatch(agendaPage, /pendência\(s\) enfileirada\(s\)|worker concluirá|lote/);
  assert.doesNotMatch(settingsPage, /Variáveis ausentes:/);
  assert.match(agendaPage, /Agenda sincronizada\. Seus compromissos já estão atualizados\./);
  assert.match(agendaPage, /Importado do Google Agenda/);
  assert.match(settingsPage, /onde os compromissos do CRM serão sincronizados/);
});

test('Imported Google events can be linked to CRM contacts without exposing that relation to Google', () => {
  const agendaPage = source('src/pages/Agenda.tsx');
  const migration = source('supabase/migrations/20260916000100_calendar_local_fields.sql');

  assert.match(agendaPage, /Contato relacionado no CRM/);
  assert.match(agendaPage, /leadId: editLeadId \|\| null/);
  assert.match(agendaPage, /Este vínculo é interno do CRM/);
  assert.doesNotMatch(migration, /update of[^\n]*lead_id/i);
});

test('mobile navigation breakpoint and touch-safe Kanban alternative stay present', () => {
  assert.match(source('src/components/layout/Sidebar.tsx'), /hidden lg:flex/);
  assert.match(source('src/components/layout/Layout.tsx'), /lg:hidden/);
  const kanban = source('src/components/leads/KanbanBoard.tsx');
  assert.match(kanban, /Mover situação/);
  assert.match(kanban, /aria-label={`Mover \$\{lead\.name\}/);
});

test('customer-facing vocabulary and progressive disclosure stay consistent', () => {
  assert.match(source('src/components/layout/Topbar.tsx'), /Canais de entrada/);
  assert.doesNotMatch(source('src/components/layout/Topbar.tsx'), /plug-and-play/i);
  assert.match(source('src/pages/Settings.tsx'), /Endereço público do escritório/);
  assert.match(source('src/components/PublicContactForm.tsx'), /Seu contato já foi registrado/);
  assert.match(source('src/components/PublicContactForm.tsx'), /Conversar pelo WhatsApp/);
  assert.doesNotMatch(source('src/components/PublicContactForm.tsx'), /Confirmar pelo WhatsApp/);
  assert.match(source('src/pages/Tasks.tsx'), /tasks\.length === 0 \|\| taskFormOpen/);
});

test('contact cards omit empty operational counters', () => {
  const leads = source('src/pages/Leads.tsx');
  assert.match(leads, /signals\.documentCount > 0/);
  assert.match(leads, /signals\.appointmentCount > 0/);
  assert.match(leads, /signals\.openFinancialCount > 0/);
});

test('demo client portal reads newly generated links from persisted demo state', () => {
  const portal = source('src/pages/PublicClientPortal.tsx');
  const demoStore = source('src/lib/demoStore.ts');
  assert.match(portal, /getDemoPortalAccessByToken\(token\)/);
  assert.doesNotMatch(portal, /mockPortalAccesses\.find/);
  assert.match(demoStore, /readDemoData\(\)\.portalAccesses\.find/);
});
