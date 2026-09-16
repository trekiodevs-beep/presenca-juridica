import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const decrypt = async (value: string, secret: string) => { const [iv, cipher] = value.split('.'); const key = await crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['decrypt']); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, key, decode(cipher))); };
const eventPayload = (event: Record<string, any>) => ({ summary: String(event.title || ''), description: String(event.notes || ''), location: event.location ? String(event.location) : undefined, start: { dateTime: String(event.start_at), timeZone: 'UTC' }, end: { dateTime: String(event.end_at || event.start_at), timeZone: 'UTC' }, extendedProperties: { private: { crmEventId: String(event.id) } } });
const google = (token: string, path: string, init: RequestInit = {}) => fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
Deno.serve(async request => {
  if (request.method !== 'POST' || request.headers.get('x-calendar-worker-secret') !== Deno.env.get('CALENDAR_SYNC_WORKER_SECRET')) return json({ error: 'Não autorizado.' }, 401);
  const url = Deno.env.get('SUPABASE_URL'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY'); const encryption = Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY');
  if (!url || !service || !encryption) return json({ error: 'Configuração incompleta.' }, 500);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }); const claimed = await admin.rpc('claim_calendar_sync_outbox', { batch_size: 25 });
  if (claimed.error) return json({ error: 'Não foi possível reservar a fila.' }, 500); let completed = 0; let failed = 0; let conflicts = 0;
  for (const item of (claimed.data || []) as Record<string, any>[]) { try {
    const { data: event } = await admin.from('calendar_events').select('*').eq('id', item.calendar_event_id).maybeSingle(); const { data: connection } = await admin.from('calendar_connections').select('*').eq('office_id', item.office_id).eq('provider', 'google').eq('status', 'active').maybeSingle();
    if (!event || !connection?.calendar_id) throw new Error('Agenda Google não selecionada.'); const refresh = await decrypt(String(connection.encrypted_refresh_token), encryption);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID') || '', client_secret: Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET') || '', refresh_token: refresh, grant_type: 'refresh_token' }) });
    const tokens = await tokenResponse.json(); if (!tokenResponse.ok || !tokens.access_token) throw new Error('Falha ao renovar token Google.'); const calendarId = encodeURIComponent(String(connection.calendar_id)); const externalId = String(event.external_event_id || `crm_${String(event.id).replaceAll('-', '')}`); const path = `/calendars/${calendarId}/events/${encodeURIComponent(externalId)}`;
    const conditionalHeaders = event.google_etag ? { 'if-match': String(event.google_etag) } : undefined;
    if (item.operation === 'delete') {
      const response = await google(String(tokens.access_token), `${path}?sendUpdates=none`, { method: 'DELETE', headers: conditionalHeaders });
      if (response.status === 412) { await admin.from('calendar_events').update({ sync_status: 'conflict', sync_error: 'O compromisso foi alterado no Google Agenda antes da exclusão.' }).eq('id', event.id); await admin.from('calendar_sync_outbox').update({ status: 'completed', locked_at: null, last_error: 'Conflito de versão do Google Agenda.' }).eq('id', item.id); conflicts++; continue; }
      if (!response.ok && response.status !== 404) throw new Error(`Google delete ${response.status}`);
      await admin.from('calendar_events').update({ external_provider: 'google', external_calendar_id: connection.calendar_id, external_event_id: externalId, sync_status: 'cancelled', sync_error: null, last_synced_at: new Date().toISOString() }).eq('id', event.id);
    }
    else {
      let response = await google(String(tokens.access_token), `${path}?sendUpdates=none`, { method: 'PATCH', headers: conditionalHeaders, body: JSON.stringify(eventPayload(event)) });
      if (response.status === 412) { await admin.from('calendar_events').update({ sync_status: 'conflict', sync_error: 'O compromisso também foi alterado no Google Agenda.' }).eq('id', event.id); await admin.from('calendar_sync_outbox').update({ status: 'completed', locked_at: null, last_error: 'Conflito de versão do Google Agenda.' }).eq('id', item.id); conflicts++; continue; }
      if (response.status === 404) response = await google(String(tokens.access_token), `/calendars/${calendarId}/events?sendUpdates=none`, { method: 'POST', body: JSON.stringify({ ...eventPayload(event), id: externalId }) });
      if (!response.ok) throw new Error(`Google upsert ${response.status}`);
      const remote = await response.json(); const payload = { title: event.title, type: event.type, status: event.status, startAt: event.start_at, endAt: event.end_at || event.start_at, location: event.location, notes: event.notes, attendees: event.attendees || [] };
      await admin.from('calendar_events').update({ external_provider: 'google', external_calendar_id: connection.calendar_id, external_event_id: externalId, google_etag: remote.etag || null, google_updated_at: remote.updated || null, sync_status: 'synced', sync_error: null, last_synced_at: new Date().toISOString() }).eq('id', event.id); await admin.from('calendar_event_snapshots').insert({ office_id: event.office_id, calendar_event_id: event.id, source: 'crm', payload, etag: remote.etag || null });
    }
    await admin.from('calendar_sync_outbox').update({ status: 'completed', locked_at: null, last_error: null }).eq('id', item.id); completed++;
  } catch (error) { const attempts = Number(item.attempts || 1); const exhausted = attempts >= 8; const message = error instanceof Error ? error.message : 'Erro de sincronização desconhecido.'; await admin.from('calendar_sync_outbox').update({ status: exhausted ? 'failed' : 'pending', available_at: new Date(Date.now() + Math.min(60 * 60 * 1000, 2 ** attempts * 1000)).toISOString(), locked_at: null, last_error: message, dead_lettered_at: exhausted ? new Date().toISOString() : null }).eq('id', item.id); await admin.from('calendar_events').update({ sync_status: exhausted ? 'failed' : 'pending', sync_error: message }).eq('id', item.calendar_event_id); failed++; } }
  return json({ claimed: (claimed.data || []).length, completed, failed, conflicts });
});
