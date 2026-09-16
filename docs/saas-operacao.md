# Operação do SaaS Presença Jurídica

## Backend atual

- Auth, Postgres, RLS, Storage, Realtime e Functions usam Supabase.
- O frontend recebe somente a publishable key e o JWT da sessão.
- Service role, refresh tokens Google e chaves de criptografia ficam exclusivamente nas Edge Functions.
- O modo mock é demonstrativo e não representa isolamento multi-tenant.

## Operação crítica

- Convites, LGPD, suporte e diagnóstico autorizado são processados por Functions com escopo e auditoria.
- Documentos usam Storage privado e URLs temporárias emitidas pelo backend.
- Google Agenda usa OAuth, `calendar_connections`, `calendar_events`, snapshots e `calendar_sync_outbox`.
- `calendar-sync-worker` processa CRM → Google; `calendar-reconcile` processa Google → CRM com `syncToken`.
- O scheduler deve chamar ambos com `CALENDAR_SYNC_WORKER_SECRET`; o webhook apenas agenda uma reconciliação.
- Exclusões são lógicas e conflitos ficam explícitos até decisão do usuário.
- A correção de cobrança Asaas está implementada e publicada no GitHub em `e54aa1d`; a aplicação remota da migration `20260916000300`, o redeploy das Functions `billing-*` e o E2E Sandbox ainda não foram comprovados para essa revisão.

## Variáveis de backend

- APP_URL
- GOOGLE_CALENDAR_CLIENT_ID
- GOOGLE_CALENDAR_CLIENT_SECRET
- GOOGLE_CALENDAR_REDIRECT_URI
- CALENDAR_TOKEN_ENCRYPTION_KEY
- CALENDAR_SYNC_WORKER_SECRET
- GOOGLE_CALENDAR_WEBHOOK_TOKEN
- ASAAS_API_BASE_URL
- ASAAS_API_KEY
- ASAAS_WEBHOOK_TOKEN

## Gates de homologação

- dois escritórios sem leitura cruzada;
- papéis owner, admin, lawyer, assistant e read;
- convites, documentos, portal e LGPD;
- OAuth, listagem, seleção, CRUD, exclusão, retry, idempotência, reconciliação incremental e conflitos da agenda;
- suporte autorizado, expiração e trilha de auditoria;
- backup/restore, logs e alertas.
- checkout Asaas, confirmação via webhook, duplicidade de evento, atraso, estorno, chargeback e cancelamento com preservação do período pago.

Build local não comprova esses gates externos.
