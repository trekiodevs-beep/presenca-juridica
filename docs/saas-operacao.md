# Operação do SaaS Presença Jurídica

## Backend atual

- Auth, Postgres, RLS, Storage, Realtime e Functions usam Supabase.
- O frontend recebe somente a publishable key e o JWT da sessão.
- Service role, refresh tokens Google e chaves de criptografia ficam exclusivamente nas Edge Functions.
- O modo mock é demonstrativo e não representa isolamento multi-tenant.

## Operação crítica

- Convites, LGPD, suporte e diagnóstico autorizado são processados por Functions com escopo e auditoria.
- Documentos usam Storage privado e URLs temporárias emitidas pelo backend.
- Google Agenda usa OAuth, calendar_connections e calendar_sync_outbox.
- O worker de agenda deve ser chamado por scheduler com CALENDAR_SYNC_WORKER_SECRET.
- Cobrança permanece desabilitada até gateway, webhook idempotente e homologação.

## Variáveis de backend

- APP_URL
- GOOGLE_CALENDAR_CLIENT_ID
- GOOGLE_CALENDAR_CLIENT_SECRET
- GOOGLE_CALENDAR_REDIRECT_URI
- CALENDAR_TOKEN_ENCRYPTION_KEY
- CALENDAR_SYNC_WORKER_SECRET

## Gates de homologação

- dois escritórios sem leitura cruzada;
- papéis owner, admin, lawyer, assistant e read;
- convites, documentos, portal e LGPD;
- OAuth, listagem, seleção, retry e idempotência da agenda;
- suporte autorizado, expiração e trilha de auditoria;
- backup/restore, logs e alertas.

Build local não comprova esses gates externos.
