import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), char => char.charCodeAt(0));
};
const encrypt = async (value: string, secret: string) => {
  const keyBytes = decode(secret);
  if (keyBytes.length !== 32) throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY deve ter 32 bytes em base64.');
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value)));
  return `${encode(iv)}.${encode(ciphertext)}`;
};

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const appUrl = Deno.env.get('APP_URL') || 'http://127.0.0.1:3000';
  const redirect = (result: string) => new Response(null, {
    status: 303,
    headers: { location: `${appUrl}/settings?calendar=${result}`, 'cache-control': 'no-store' },
  });
  if (!state || !code) return redirect('error');
  let stage = 'configuration';
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
    const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET');
    const encryptionKey = Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY');
    if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret || !encryptionKey) return redirect('not_configured');
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    stage = 'state_lookup';
    const { data: oauthState, error: stateError } = await admin
      .from('calendar_oauth_states')
      .select('*')
      .eq('state', state)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (stateError) {
      console.error('calendar-oauth-callback state query failed', { code: stateError.code, message: stateError.message });
      return redirect('server_error');
    }
    if (!oauthState) return redirect('invalid_state');
    stage = 'token_exchange';
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: oauthState.redirect_uri, grant_type: 'authorization_code' }) });
    const tokenPayload = await tokenResponse.text();
    let tokens: { access_token?: string; refresh_token?: string; scope?: string };
    try { tokens = JSON.parse(tokenPayload); } catch { return redirect('token_error'); }
    if (!tokenResponse.ok || !tokens.refresh_token) return redirect('token_error');
    let googleAccountEmail = '';
    if (tokens.access_token) {
      stage = 'profile_lookup';
      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        googleAccountEmail = typeof profile.email === 'string' ? profile.email : '';
      }
    }
    stage = 'token_encryption';
    const encryptedRefreshToken = await encrypt(tokens.refresh_token, encryptionKey);
    stage = 'connection_upsert';
    const { error: connectionError } = await admin.from('calendar_connections').upsert({ office_id: oauthState.office_id, user_id: oauthState.user_id, provider: 'google', google_account_email: googleAccountEmail, calendar_id: 'primary', calendar_name: 'Agenda principal', encrypted_refresh_token: encryptedRefreshToken, scopes: String(tokens.scope || '').split(' ').filter(Boolean), status: 'active' }, { onConflict: 'office_id,user_id,provider' });
    if (connectionError) {
      console.error('calendar-oauth-callback connection upsert failed', { code: connectionError.code, message: connectionError.message });
      return redirect('error');
    }
    await admin.from('calendar_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('state', state);
    return redirect('connected');
  } catch (error) {
    console.error('calendar-oauth-callback failed', { stage, name: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Unknown error' });
    return redirect('server_error');
  }
});
