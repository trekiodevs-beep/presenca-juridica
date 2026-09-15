# Runbook de produção — Presença Jurídica CRM

Este runbook corresponde à arquitetura Supabase + Vite. Build, migration, deploy e jornada comprovada são evidências diferentes; nenhuma substitui a homologação externa.

## 1. Pré-requisitos

- Node.js 22, npm, Docker Desktop e Supabase CLI.
- Projeto Supabase e domínio aprovados.
- Projeto Google Cloud para OAuth Calendar usando `trekiodevs@gmail.com`.
- Nenhum segredo em Vite, GitHub, bundle ou logs.

## 2. Variáveis públicas do frontend

No Coolify, use `.env.docker.example` como referência. Essas variáveis são build-time e não devem ser confundidas com os secrets das Edge Functions.

```env
VITE_SUPABASE_URL="https://PROJECT_REF.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="..."
VITE_BACKEND_PROVIDER="supabase"
VITE_USE_MOCK_DATA="false"
```

Localmente, use os valores de `supabase status`. Mock valida apenas UI; não valida Auth, RLS, Storage ou Functions.

## 3. Secrets das Edge Functions

Configure somente no painel/CLI do Supabase:

```env
APP_URL="https://crm.seudominio.com.br"
GOOGLE_CALENDAR_CLIENT_ID="..."
GOOGLE_CALENDAR_CLIENT_SECRET="..."
GOOGLE_CALENDAR_REDIRECT_URI="https://PROJECT_REF.supabase.co/functions/v1/calendar-oauth-callback"
CALENDAR_TOKEN_ENCRYPTION_KEY="base64 de exatamente 32 bytes"
CALENDAR_SYNC_WORKER_SECRET="segredo forte do worker"
GOOGLE_CALENDAR_WEBHOOK_TOKEN="segredo forte do webhook"
```

`GOOGLE_CALENDAR_CLIENT_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_KEY`, `CALENDAR_SYNC_WORKER_SECRET`, `GOOGLE_CALENDAR_WEBHOOK_TOKEN` e `SUPABASE_SERVICE_ROLE_KEY` nunca podem aparecer no bundle ou em logs.

## 4. Validação local

```powershell
supabase start
supabase db reset
supabase migration list
supabase status
npm run lint
npm test
npm run build
```

`tests-rules` ainda é cobertura histórica Firestore. Antes do go-live, substituir por uma suíte RLS Supabase com dois escritórios, isolamento cruzado e todos os papéis.

## 5. OAuth Google Agenda

No Google Cloud:

1. habilite Google Calendar API;
2. crie OAuth Client Web;
3. adicione `http://127.0.0.1:54321/functions/v1/calendar-oauth-callback`;
4. adicione o redirect URI Cloud;
5. configure os secrets;
6. publique as Functions OAuth, listagem e seleção;
7. conecte uma conta real e selecione uma agenda gravável.

O `calendar-sync-worker` deve ser executado por scheduler/cron com o header `x-calendar-worker-secret`. Valide criação, atualização, retry, idempotência, token expirado e conflito.

## 6. Deploy Supabase

```powershell
supabase link --project-ref PROJECT_REF
supabase db push
supabase secrets set APP_URL=... GOOGLE_CALENDAR_CLIENT_ID=... GOOGLE_CALENDAR_CLIENT_SECRET=... GOOGLE_CALENDAR_REDIRECT_URI=... CALENDAR_TOKEN_ENCRYPTION_KEY=... CALENDAR_SYNC_WORKER_SECRET=...
supabase functions deploy calendar-oauth-start
supabase functions deploy calendar-oauth-callback
supabase functions deploy calendar-connection-status
supabase functions deploy calendar-list
supabase functions deploy calendar-select
supabase functions deploy calendar-sync-worker --no-verify-jwt
supabase functions deploy calendar-sync-now
supabase functions deploy calendar-reconcile --no-verify-jwt
supabase functions deploy calendar-event-delete
supabase functions deploy calendar-conflict-resolve
supabase functions deploy calendar-webhook --no-verify-jwt
supabase functions deploy platform-admin
supabase functions deploy support-access
supabase functions deploy support-requests
```

Configure Auth URLs, redirects, Storage policies e Realtime no painel. Confirme que migrations e Functions usam o mesmo `PROJECT_REF`.

Após `supabase db push`, confirme que `leads`, `tasks`, `calendar_events` e `financial_records` pertencem à publicação `supabase_realtime`. A migration versionada responsável é `20260915000100_core_realtime.sql`. A existência do arquivo local não comprova que a publicação remota foi atualizada.

## 7. Deploy do frontend

O Coolify pode apontar diretamente para o `Dockerfile` da raiz. O `docker/compose.yml` existe para reproduzir localmente o mesmo build e não sobe o Supabase; ele serve apenas o frontend.

- branch: `main` após CI verde;
- build: `npm ci && npm run build`;
- saída: `dist`;
- fallback SPA para `index.html`;
- container Docker: Nginx na porta `8080`, healthcheck em `/healthz`;
- HTTPS obrigatório;
- variáveis públicas de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_BACKEND_PROVIDER`, `VITE_PUBLIC_APP_URL` e `VITE_USE_MOCK_DATA=false`;
- healthcheck: `/healthz` com HTTP 200.

## 8. Homologação obrigatória

Prove com dois escritórios descartáveis:

1. login, logout, aceite legal e onboarding;
2. isolamento RLS entre escritórios;
3. papéis `owner`, `admin`, `lawyer`, `assistant` e `read`;
4. convites e transferência de propriedade;
5. leads, tarefas, documentos e portal;
6. OAuth, listagem, seleção, CRUD e sincronização bidirecional Google Agenda;
7. retry, idempotência, exclusão, `syncToken`, `410 Gone` e conflitos;
8. inbox, suporte autorizado, expiração e auditoria;
9. LGPD, backup, restore, logs e alertas.
10. interface em celular, tablet e desktop conforme `docs/interface-feedback-responsividade.md`;
11. atualização otimista, rollback, Realtime entre duas sessões e recuperação após desconexão.

Mock, build-only ou falha de isolamento significa no-go.

## 9. Git e release

```powershell
git status --short --branch
git diff --check
npm ci
npm run lint
npm test
npm run build
```

Separe alterações preexistentes, crie commit específico da migração Supabase, publique branch, aguarde CI e só então faça merge em `main`. Não ative cobrança antes da homologação externa.
