import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const encrypt = async (value: string, secret: string) => {
  const keyBytes = Uint8Array.from(atob(secret), char => char.charCodeAt(0));
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
  if (!state || !code) return Response.redirect(`${appUrl}/settings?calendar=error`, 303);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('BACKEND_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  const clientId = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET');
  const encryptionKey = Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY');
  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret || !encryptionKey) return Response.redirect(`${appUrl}/settings?calendar=not_configured`, 303);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: oauthState } = await admin.from('calendar_oauth_states').select('*').eq('state', state).is('consumed_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!oauthState) return Response.redirect(`${appUrl}/settings?calendar=invalid_state`, 303);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: oauthState.redirect_uri, grant_type: 'authorization_code' }) });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.refresh_token) return Response.redirect(`${appUrl}/settings?calendar=token_error`, 303);
  let googleAccountEmail = '';
  if (tokens.access_token) {
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      googleAccountEmail = typeof profile.email === 'string' ? profile.email : '';
    }
  }
  const encryptedRefreshToken = await encrypt(tokens.refresh_token, encryptionKey);
  const { error: connectionError } = await admin.from('calendar_connections').upsert({ office_id: oauthState.office_id, user_id: oauthState.user_id, provider: 'google', google_account_email: googleAccountEmail, calendar_id: 'primary', calendar_name: 'Agenda principal', encrypted_refresh_token: encryptedRefreshToken, scopes: String(tokens.scope || '').split(' ').filter(Boolean), status: 'active' }, { onConflict: 'office_id,user_id,provider' });
  if (connectionError) return Response.redirect(`${appUrl}/settings?calendar=error`, 303);
  await admin.from('calendar_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('state', state);
  return Response.redirect(`${appUrl}/settings?calendar=connected`, 303);
});
