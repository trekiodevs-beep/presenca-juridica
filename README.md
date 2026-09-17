# Presenca Juridica CRM

CRM juridico para captacao, triagem, tarefas, agenda, financeiro, documentos e portal do cliente.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Para rodar com dados demonstrativos:

```env
VITE_USE_MOCK_DATA="true"
```

Para producao, use:

```env
VITE_USE_MOCK_DATA="false"
```

## Build

```bash
npm run lint
npm run build
```

## Deploy no Coolify via GitHub

Use o tipo de aplicacao `Dockerfile`.

Configuracao recomendada:

- Repository: `trekiodevs-beep/presenca-juridica`
- Branch: `codex/saas-production-readiness` para homologação; `main` após merge aprovado
- Build Pack: `Dockerfile`
- Port: `8080`
- Healthcheck path: `/healthz`

Variaveis de ambiente/build:

```env
VITE_SUPABASE_URL="https://PROJECT_REF.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY=""
VITE_BACKEND_PROVIDER="supabase"
VITE_PUBLIC_APP_URL="https://crm.example.com"
VITE_USE_MOCK_DATA="false"
```

Use [.env.docker.example](.env.docker.example) como referência exclusiva das variáveis públicas do build no Coolify. Os secrets das Edge Functions são configurados separadamente no Supabase.

Para validar o mesmo pacote localmente antes do Coolify:

```powershell
Copy-Item .env.docker.example .env.docker
docker compose --env-file .env.docker -f docker/compose.yml up --build -d
docker compose --env-file .env.docker -f docker/compose.yml ps
```

O Compose publica o frontend em `http://localhost:8080`; o Supabase continua externo ao container.

Observacoes:

- As variaveis `VITE_*` sao lidas no build do Vite. No Coolify, configure-as como build arguments antes do primeiro deploy.
- O container serve a SPA pelo Nginx na porta `8080` e expõe `/healthz` para o healthcheck do Coolify.
- Depois de associar o dominio no provedor, configure o domínio em Supabase Auth > URL Configuration.
- Aplique as migrations, políticas RLS e configurações Storage do diretório `supabase/` antes de liberar clientes reais.
- O app usa Supabase Auth, Postgres, Storage e Edge Functions. Chaves secretas ficam exclusivamente nas Functions; o frontend usa apenas a publishable key e o JWT da sessão.

## Camada SaaS

O repositório contém a primeira implementação comercial completa da camada SaaS:

- planos `trial`, `essential`, `professional` e `custom`, com limites e permissões tipados;
- estados de assinatura `TRIALING`, `ACTIVE`, `PAST_DUE`, `GRACE_PERIOD`, `SUSPENDED` e `CANCELED`;
- bloqueio real de mutações no cliente e nas políticas RLS quando o acesso é somente leitura;
- tela de Plano e cobrança, equipe, convite por token hash e aceitação vinculada ao e-mail autenticado;
- Supabase Edge Functions para checkout/troca/cancelamento, cobranças e 2ª via, inbox idempotente de webhook Asaas, reconciliação, avisos de trial e limites de usuários, contatos e armazenamento;
- auditoria de ações sensíveis, migrations SQL versionadas e Edge Functions.
- MFA opcional, documentos legais/aceite versionado, solicitações LGPD, suporte com consentimento temporário e backup/restauração.

### Publicação das Edge Functions

As Functions Supabase ficam em `supabase/functions`. Antes de publicar:

```bash
supabase db push
supabase functions deploy calendar-oauth-start
supabase functions deploy calendar-oauth-callback
supabase functions deploy calendar-list
supabase functions deploy calendar-select
supabase functions deploy calendar-sync-worker --no-verify-jwt
supabase functions deploy calendar-sync-now
supabase functions deploy calendar-reconcile --no-verify-jwt
supabase functions deploy calendar-event-delete
supabase functions deploy calendar-conflict-resolve
supabase functions deploy calendar-webhook --no-verify-jwt
supabase functions deploy calendar-disconnect --no-verify-jwt
```

Configure os secrets no Supabase, incluindo `APP_URL`, credenciais OAuth Google, `CALENDAR_TOKEN_ENCRYPTION_KEY`, `CALENDAR_SYNC_WORKER_SECRET` e `GOOGLE_CALENDAR_WEBHOOK_TOKEN`. Nunca coloque refresh tokens ou service-role keys no frontend.

### Limites e dados existentes

Escritórios criados a partir desta versão recebem `planCode`, `limits`, `trialEndsAtMs` e membership do proprietário no mesmo batch. Escritórios antigos precisam passar pelo fluxo de migração/regularização do trial antes que as novas Rules permitam alterações; isso é deliberado para evitar liberar acesso comercialmente expirado por ausência de data numérica.

O build e os testes locais não comprovam publicação, credenciais Asaas, configuração de App Check, banco nomeado, regras remotas, webhook recebido, e-mail enviado ou restauração de backup. Esses itens continuam sendo gates de homologação.

Runbooks: [interface, feedback e responsividade](docs/interface-feedback-responsividade.md), [deploy de produção](docs/deploy-producao.md), [operação SaaS](docs/saas-operacao.md), [backup/restauração](docs/backup-restore.md), [resposta a incidentes](docs/incident-response.md), [anexo de operador](docs/data-processing-agreement-template.md) e [checklist de release](docs/release-checklist.md). Os textos legais incluídos no produto precisam de revisão jurídica antes do uso comercial.

## Checklist antes de divulgar

- Build de producao concluido.
- App publicado em dominio estavel.
- Domínio configurado no Supabase Auth.
- Postgres, RLS e Storage validados fora do modo mock.
- Criacao de escritorio validada.
- Lead publico validado.
- Upload de documento validado.
- Portal do cliente validado.
- Isolamento entre escritorios validado.
- Interface validada em celular, tablet e desktop.
- Feedback, rollback e prevenção de duplo envio validados.
- Realtime validado entre duas sessões, com recuperação após desconexão.

Documentação do Google Calendar:

- [Guia mestre de integração com Google Calendar](docs/guia-mestre-integracao-google-calendar.md): referência reutilizável de arquitetura, OAuth, segurança, sincronização, verificação, testes e produção;
- [Operação e release do Google Calendar](docs/calendar-google-operacao.md): runbook operacional deste sistema;
- [Plano de sincronização bidirecional](docs/plano-sincronizacao-google-calendar.md): decisões de produto, modelo e implementação do CRM.

Documentação de cobrança SaaS:

- [Padrão Asaas + Supabase](docs/saas-billing-asaas-supabase.md): arquitetura replicável, catálogo de preços, Edge Functions, webhook idempotente, segurança, homologação e operação.
