import { createClient } from '@supabase/supabase-js';

const email = (process.env.SEED_EMAIL || 'trekiodevs@gmail.com').toLowerCase();
const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY para executar a seed.');
const db = createClient(url, key, { auth: { persistSession: false } });

const profile = (await db.from('profiles').select('id,name,email').eq('email', email).maybeSingle()).data;
if (!profile) throw new Error(`Perfil não encontrado para ${email}. Faça login antes de executar a seed.`);

let office = (await db.from('offices').select('id,name').eq('owner_user_id', profile.id).maybeSingle()).data;
const trialStartedAt = new Date();
const trialEndsAt = new Date(trialStartedAt.getTime() + 15 * 24 * 60 * 60 * 1000);
if (!office) {
  const result = await db.from('offices').insert({ name: 'TrekIO Advocacia — Demo', lawyer_name: profile.name || 'TrekIO', email, owner_user_id: profile.id, city: 'São Paulo', state: 'SP', subscription_status: 'TRIALING', plan_code: 'trial', trial_started_at: trialStartedAt.toISOString(), trial_ends_at: trialEndsAt.toISOString(), trial_ends_at_ms: trialEndsAt.getTime(), limits: { maxUsers: 2, maxContacts: 100, maxStorageBytes: 536870912 }, onboarding_completed_at: new Date().toISOString() }).select('id,name').single();
  if (result.error) throw result.error;
  office = result.data;
}
const trialUpdate = await db.from('offices').update({ subscription_status: 'TRIALING', plan_code: 'trial', trial_started_at: trialStartedAt.toISOString(), trial_ends_at: trialEndsAt.toISOString(), trial_ends_at_ms: trialEndsAt.getTime(), deletion_scheduled_at: null }).eq('id', office.id);
if (trialUpdate.error) throw trialUpdate.error;
const membership = await db.from('memberships').select('id').eq('office_id', office.id).eq('user_id', profile.id).maybeSingle();
if (!membership.data) {
  const result = await db.from('memberships').insert({ office_id: office.id, user_id: profile.id, email, name: profile.name || 'TrekIO', role: 'owner', status: 'active' });
  if (result.error) throw result.error;
}
const profileUpdate = await db.from('profiles').update({ office_id: office.id, role: 'owner' }).eq('id', profile.id);
if (profileUpdate.error) throw profileUpdate.error;

const seedTag = 'SEED_SUPER_DEMO_CENTRAL_ATENCAO';
const existing = await db.from('leads').select('id').eq('office_id', office.id).eq('source', seedTag).limit(1);
if (existing.error) throw existing.error;
if (!existing.data?.length) {
  const now = Date.now();
  const leadSeed = [
    ['Maria Oliveira', 'Direito Trabalhista', 'Novo contato', 'Alta'], ['Carlos Mendes', 'Direito de Família', 'Aguardando triagem', 'Média'], ['Ana Souza', 'Direito do Consumidor', 'Em triagem', 'Alta'], ['Rafael Lima', 'Direito Empresarial', 'Triagem realizada', 'Média'], ['Juliana Costa', 'Direito Previdenciário', 'Proposta enviada', 'Alta'], ['Pedro Alves', 'Direito Civil', 'Negociação', 'Média'], ['Fernanda Rocha', 'Direito Trabalhista', 'Contratado', 'Alta'], ['Lucas Martins', 'Direito de Família', 'Sem interesse', 'Baixa'], ['Beatriz Santos', 'Direito Imobiliário', 'Novo contato', 'Média'], ['Gustavo Nunes', 'Direito Penal', 'Aguardando triagem', 'Alta'], ['Camila Freitas', 'Direito Tributário', 'Triagem realizada', 'Média'], ['Diego Ramos', 'Direito Digital', 'Proposta enviada', 'Baixa'],
  ];
  const leads = await db.from('leads').insert(leadSeed.map(([name, area, status, priority], index) => ({ office_id: office.id, name: `${name} (demo)`, phone: `1198888${String(100 + index).padStart(4, '0')}`, email: `${name.toLowerCase().replaceAll(' ', '.')}@demo.example.com`, source: seedTag, area, status, priority, summary: `Caso de demonstração em ${area}.`, notes: 'Dados fictícios para homologação.', next_action_text: index % 3 === 0 ? 'Realizar retorno ao contato' : 'Revisar informações recebidas', next_action_at: new Date(now + (index < 4 ? -1 : index + 1) * 24 * 60 * 60 * 1000).toISOString(), consent_lgpd: true, responsible_user_id: index % 3 === 0 ? profile.id : null }))).select('id,name');
  if (leads.error) throw leads.error;
  const leadIds = (leads.data || []).map(row => row.id);
  const events = await db.from('lead_events').insert(leadIds.slice(0, 8).map((leadId, index) => ({ office_id: office.id, lead_id: leadId, type: index % 2 ? 'Nota' : 'Contato recebido', description: `${seedTag}: histórico de atendimento ${index + 1}`, created_by: profile.id })));
  if (events.error) throw events.error;
  const tasks = await db.from('tasks').insert(leadIds.slice(0, 10).map((leadId, index) => ({ office_id: office.id, lead_id: leadId, title: `${index < 4 ? 'Providência vencida' : 'Acompanhar atendimento'} — caso demo ${index + 1}`, due_at: new Date(now + (index < 4 ? -index - 1 : index + 1) * 24 * 60 * 60 * 1000).toISOString(), done: index === 7, responsible_user_id: profile.id, created_by: profile.id })));
  if (tasks.error) throw tasks.error;
  const calendar = await db.from('calendar_events').insert(leadIds.slice(0, 8).map((leadId, index) => ({ office_id: office.id, lead_id: leadId, title: `${index % 2 ? 'Consulta' : 'Reunião'} — caso demo ${index + 1}`, type: index % 2 ? 'Consulta' : 'Reunião', status: 'Agendado', start_at: new Date(now + (index === 0 ? 60 : index + 2) * 60 * 60 * 1000).toISOString(), end_at: new Date(now + (index === 0 ? 120 : index + 3) * 60 * 60 * 1000).toISOString(), location: index % 2 ? 'Videoconferência' : 'Escritório', responsible_user_id: profile.id })));
  if (calendar.error) throw calendar.error;
  const finance = await db.from('financial_records').insert(leadIds.slice(0, 8).map((leadId, index) => ({ office_id: office.id, lead_id: leadId, type: index % 2 ? 'Honorário' : 'Custas', status: index < 3 ? 'Vencido' : index === 3 ? 'Pago' : 'Previsto', description: `${index % 2 ? 'Honorário' : 'Custas'} — caso demo ${index + 1}`, amount: 750 + index * 425, due_at: new Date(now + (index < 3 ? -index - 2 : index + 5) * 24 * 60 * 60 * 1000).toISOString(), paid_at: index === 3 ? new Date().toISOString() : null })));
  if (finance.error) throw finance.error;
}
const evaluation = await db.rpc('evaluate_office_operational_alarms', { target_office_id: office.id });
if (evaluation.error) throw evaluation.error;
const alarms = await db.from('operational_alarms').select('id,rule_code,state').eq('office_id', office.id).in('state', ['OPEN', 'ACKNOWLEDGED']);
if (alarms.error) throw alarms.error;
console.log(JSON.stringify({ email, officeId: office.id, officeName: office.name, evaluation: evaluation.data, activeAlarmCount: alarms.data?.length || 0 }, null, 2));
