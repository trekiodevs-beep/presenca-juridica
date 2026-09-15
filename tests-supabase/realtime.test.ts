import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY para executar o teste Realtime.');

test('lead criado em uma sessão é entregue a outra sessão pelo Realtime', async () => {
  const writer = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const reader = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `realtime-${suffix}@example.test`;
  let userId = ''; let officeId = '';

  try {
    const user = await writer.auth.admin.createUser({ email, password: `Realtime-${suffix}-Strong!`, email_confirm: true });
    if (user.error || !user.data.user) throw user.error || new Error('Usuário Realtime não criado.');
    userId = user.data.user.id;
    const profile = await writer.from('profiles').insert({ id: userId, name: 'Realtime Test', email });
    if (profile.error) throw profile.error;
    const office = await writer.from('offices').insert({ name: `Realtime ${suffix}`, lawyer_name: 'Realtime', owner_user_id: userId }).select('id').single();
    if (office.error || !office.data) throw office.error || new Error('Escritório Realtime não criado.');
    officeId = office.data.id;

    const received = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Evento Realtime não recebido em 8 segundos.')), 8000);
      let inserted = false;
      const channel = reader.channel(`realtime-contract-${suffix}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `office_id=eq.${officeId}` }, payload => {
          clearTimeout(timeout); resolve(payload.new as Record<string, unknown>);
        })
        .subscribe(async status => {
          if (status !== 'SUBSCRIBED' || inserted) return;
          inserted = true;
          // The local Realtime container acknowledges the channel before its
          // CDC replication process has necessarily finished warming up.
          await new Promise(resolve => setTimeout(resolve, 1000));
          const insertResult = await writer.from('leads').insert({ office_id: officeId, name: 'Contato Realtime', phone: '5535999999999', area: 'Outro' });
          if (insertResult.error) { clearTimeout(timeout); reject(insertResult.error); }
        });
      void channel;
    });

    const lead = await received;
    assert.equal(lead.office_id, officeId);
    assert.equal(lead.name, 'Contato Realtime');
  } finally {
    await reader.removeAllChannels();
    if (officeId) await writer.from('offices').delete().eq('id', officeId);
    if (userId) await writer.auth.admin.deleteUser(userId);
  }
});
