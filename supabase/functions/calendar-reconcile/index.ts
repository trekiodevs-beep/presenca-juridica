import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const decrypt = async (value: string, secret: string) => {
  const [iv, cipher] = value.split('.');
  const key = await crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, key, decode(cipher)));
};
const tokenFor = async (connection: Record<string, unknown>) => {
  const refreshToken = await decrypt(String(connection.encrypted_refresh_token), String(Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY')));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
    client_id: Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID') || '',
    client_secret: Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET') || '', refresh_token: refreshToken, grant_type: 'refresh_token'
  }) });
  const data = await response.json(); if (!response.ok || !data.access_token) throw new Error('Não foi possível renovar o acesso Google.'); return String(data.access_token);
};
const normalized = (item: Record<string, any>) => {
  const start = item.start?.dateTime || `${item.start?.date}T00:00:00.000Z`;
  const end = item.end?.dateTime || `${item.end?.date || item.start?.date}T00:00:00.000Z`;
  return { title: String(item.summary || 'Evento Google'), startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), location: item.location ? String(item.location) : null, notes: item.description ? String(item.description) : null, status: item.status === 'cancelled' ? 'Cancelado' : 'Agendado', attendees: Array.isArray(item.attendees) ? item.attendees.map((a: any) => ({ email: String(a.email || ''), displayName: a.displayName ? String(a.displayName) : null, responseStatus: a.responseStatus ? String(a.responseStatus) : null })) : [] };
};

const reconcileOffice = async (admin: ReturnType<typeof createClient>, officeId: string, mode: 'manual' | 'scheduled' | 'webhook', requestedRunId?: string) => {
  const { data: connection, error: connectionError } = await admin.from('calendar_connections').select('*').eq('office_id', officeId).eq('provider', 'google').eq('status', 'active').maybeSingle();
  if (connectionError || !connection?.calendar_id) throw new Error('Agenda Google não selecionada.');
  const run = requestedRunId
    ? await admin.from('calendar_sync_runs').update({ mode, status: 'running' }).eq('id', requestedRunId).eq('office_id', officeId).select('id').single()
    : await admin.from('calendar_sync_runs').insert({ office_id: officeId, mode, status: 'running' }).select('id').single();
  if (run.error || !run.data) throw new Error('Não foi possível criar a execução.');
  let received = 0; let updated = 0; let created = 0; let deleted = 0; let conflicts = 0; let pageToken: string | undefined; let syncToken = connection.calendar_sync_token ? String(connection.calendar_sync_token) : undefined; let retriedFull = false;
  try {
    const accessToken = await tokenFor(connection);
    do {
      const params = new URLSearchParams({ showDeleted: 'true', singleEvents: 'true', maxResults: '250' });
      if (syncToken) params.set('syncToken', syncToken); else params.set('timeMin', new Date(0).toISOString());
      if (pageToken) params.set('pageToken', pageToken);
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(String(connection.calendar_id))}/events?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (response.status === 410 && !retriedFull) { retriedFull = true; syncToken = undefined; pageToken = undefined; continue; }
      if (!response.ok) throw new Error(`Google reconcile ${response.status}`);
      const data = await response.json();
      for (const item of (data.items || []) as Record<string, any>[]) {
        if (!item.id) continue; received++;
        const payload = normalized(item); const externalId = String(item.id); const remoteDeleted = item.status === 'cancelled';
        const { data: local } = await admin.from('calendar_events').select('*').eq('office_id', officeId).eq('external_provider', 'google').eq('external_calendar_id', connection.calendar_id).eq('external_event_id', externalId).maybeSingle();
        if (!local) {
          if (!remoteDeleted) { await admin.rpc('create_calendar_remote_event', { target_office_id: officeId, target_calendar_id: connection.calendar_id, target_external_id: externalId, remote_payload: payload, remote_etag: item.etag || null, remote_updated_at: item.updated || null }); created++; }
          continue;
        }
        await admin.from('calendar_event_snapshots').insert({ office_id: officeId, calendar_event_id: local.id, source: 'google', payload, etag: item.etag || null });
        const hasLocalChange = local.last_local_change_at && (!local.last_remote_change_at || new Date(local.last_local_change_at).getTime() > new Date(local.last_remote_change_at).getTime()) && local.google_etag && local.google_etag !== item.etag;
        if (hasLocalChange) { await admin.from('calendar_events').update({ sync_status: 'conflict', sync_error: 'Alterações simultâneas no CRM e no Google.' }).eq('id', local.id); conflicts++; continue; }
        await admin.rpc('set_calendar_remote_state', { target_event_id: local.id, remote_payload: payload, remote_etag: item.etag || null, remote_updated_at: item.updated || null, remote_deleted: remoteDeleted }); remoteDeleted ? deleted++ : updated++;
      }
      pageToken = data.nextPageToken; if (data.nextSyncToken) syncToken = String(data.nextSyncToken);
    } while (pageToken);
    await admin.from('calendar_connections').update({ calendar_sync_token: syncToken || null, calendar_sync_token_updated_at: new Date().toISOString(), last_remote_sync_at: new Date().toISOString(), last_sync_at: new Date().toISOString(), last_error: null }).eq('id', connection.id);
    await admin.from('calendar_sync_runs').update({ status: conflicts ? 'partial' : 'completed', finished_at: new Date().toISOString(), received_count: received, updated_count: updated + created, deleted_count: deleted, conflict_count: conflicts }).eq('id', run.data.id);
    return { syncRunId: run.data.id, received, created, updated, deleted, conflicts };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na reconciliação.';
    await admin.from('calendar_connections').update({ status: message.includes('renovar') ? 'error' : 'active', last_error: message }).eq('id', connection.id);
    await admin.from('calendar_sync_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_summary: message, received_count: received, conflict_count: conflicts }).eq('id', run.data.id);
    throw error;
  }
};

Deno.serve(async request => {
  if (request.method !== 'POST' || request.headers.get('x-calendar-worker-secret') !== Deno.env.get('CALENDAR_SYNC_WORKER_SECRET')) return json({ error: 'Não autorizado.' }, 401);
  const url = Deno.env.get('SUPABASE_URL'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('BACKEND_SERVICE_ROLE_KEY');
  if (!url || !service || !Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY')) return json({ error: 'Configuração incompleta.' }, 500);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }); const body = await request.json().catch(() => ({}));
  const officeId = String(body.officeId || ''); if (!officeId) return json({ error: 'officeId é obrigatório.' }, 400);
  try { return json(await reconcileOffice(admin, officeId, body.mode === 'webhook' ? 'webhook' : body.mode === 'manual' ? 'manual' : 'scheduled', body.syncRunId ? String(body.syncRunId) : undefined)); } catch (error) { return json({ error: error instanceof Error ? error.message : 'Falha na reconciliação.' }, 500); }
});
