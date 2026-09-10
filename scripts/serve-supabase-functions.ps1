$ErrorActionPreference = 'Stop'

function Get-DotEnvValue([string]$Path, [string]$Name) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^\s*(?:export\s+)?$([regex]::Escape($Name))\s*=\s*(.*)\s*$" } | Select-Object -Last 1
  if (-not $line) { return $null }
  $value = ($line -replace "^\s*(?:export\s+)?$([regex]::Escape($Name))\s*=\s*", '').Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) { $value = $value.Substring(1, $value.Length - 2) }
  return $value
}

$rootEnv = Join-Path (Get-Location) '.env'
$clientId = Get-DotEnvValue $rootEnv 'GOOGLE_CALENDAR_CLIENT_ID'
if (-not $clientId) { $clientId = Get-DotEnvValue $rootEnv 'SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID' }
$clientSecret = Get-DotEnvValue $rootEnv 'GOOGLE_CALENDAR_CLIENT_SECRET'
if (-not $clientSecret) { $clientSecret = Get-DotEnvValue $rootEnv 'SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET' }
$encryptionKey = Get-DotEnvValue $rootEnv 'CALENDAR_TOKEN_ENCRYPTION_KEY'
$redirectUri = Get-DotEnvValue $rootEnv 'GOOGLE_CALENDAR_REDIRECT_URI'
$appUrl = Get-DotEnvValue $rootEnv 'APP_URL'

$redirectUri = if ($redirectUri) { $redirectUri } else { 'http://127.0.0.1:54321/functions/v1/calendar-oauth-callback' }
$appUrl = if ($appUrl) { $appUrl } else { 'http://localhost:3000' }
if (-not $clientId) { throw 'Credencial Google ausente: configure GOOGLE_CALENDAR_CLIENT_ID ou SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID no .env.' }
if (-not $clientSecret) { throw 'Segredo Google ausente: configure GOOGLE_CALENDAR_CLIENT_SECRET ou SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET no .env.' }
if (-not $encryptionKey) { throw 'CALENDAR_TOKEN_ENCRYPTION_KEY ausente. Gere uma chave AES-256 persistente em base64 e configure-a no ambiente local e no Supabase Cloud.' }

# O CLI ignora variáveis SUPABASE_* no --env-file. O arquivo temporário contém
# apenas os aliases da integração e é removido quando o servidor é encerrado.
$runtimeEnv = [System.IO.Path]::GetTempFileName()
try {
  @(
    "GOOGLE_CALENDAR_CLIENT_ID=$clientId",
    "GOOGLE_CALENDAR_CLIENT_SECRET=$clientSecret",
    "GOOGLE_CALENDAR_REDIRECT_URI=$redirectUri",
    "CALENDAR_TOKEN_ENCRYPTION_KEY=$encryptionKey",
    "APP_URL=$appUrl"
  ) | Set-Content -LiteralPath $runtimeEnv -Encoding ASCII
  npx supabase functions serve --env-file $runtimeEnv
}
finally {
  Remove-Item -LiteralPath $runtimeEnv -Force -ErrorAction SilentlyContinue
}
