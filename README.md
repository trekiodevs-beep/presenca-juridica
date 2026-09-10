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

- Repository: `MatheusMartins33/CRM---Presen-a-Juridica`
- Branch: `main`
- Build Pack: `Dockerfile`
- Port: `80`
- Healthcheck path: `/`

Variaveis de ambiente/build:

```env
VITE_SUPABASE_URL="https://PROJECT_REF.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY=""
VITE_BACKEND_PROVIDER="supabase"
VITE_USE_MOCK_DATA="false"
```

Observacoes:

- As variaveis `VITE_*` sao lidas no build do Vite. No Coolify, configure-as antes do primeiro deploy.
- Depois de associar o dominio no provedor, configure o domínio em Supabase Auth > URL Configuration.
- Aplique as migrations, políticas RLS e configurações Storage do diretório `supabase/` antes de liberar clientes reais.
- O app usa Supabase Auth, Postgres, Storage e Edge Functions. Chaves secretas ficam exclusivamente nas Functions; o frontend usa apenas a publishable key e o JWT da sessão.

## Camada SaaS

O repositório contém a primeira implementação comercial completa da camada SaaS:

- planos `trial`, `essential`, `professional` e `custom`, com limites e permissões tipados;
- estados de assinatura `TRIALING`, `ACTIVE`, `PAST_DUE`, `GRACE_PERIOD`, `SUSPENDED` e `CANCELED`;
- bloqueio real de mutações no cliente e nas políticas RLS quando o acesso é somente leitura;
- tela de Plano e cobrança, equipe, convite por token hash e aceitação vinculada ao e-mail autenticado;
- Cloud Functions para checkout/troca/cancelamento, cobranças e 2ª via, webhook Asaas transacional, reconciliação, avisos de trial e limites atômicos de usuários, contatos e armazenamento;
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
```

Configure os secrets no Supabase, incluindo `APP_URL`, credenciais OAuth Google, `CALENDAR_TOKEN_ENCRYPTION_KEY` e `CALENDAR_SYNC_WORKER_SECRET`. Nunca coloque refresh tokens ou service-role keys no frontend.

### Limites e dados existentes

Escritórios criados a partir desta versão recebem `planCode`, `limits`, `trialEndsAtMs` e membership do proprietário no mesmo batch. Escritórios antigos precisam passar pelo fluxo de migração/regularização do trial antes que as novas Rules permitam alterações; isso é deliberado para evitar liberar acesso comercialmente expirado por ausência de data numérica.

O build e os testes locais não comprovam publicação, credenciais Asaas, configuração de App Check, banco nomeado, regras remotas, webhook recebido, e-mail enviado ou restauração de backup. Esses itens continuam sendo gates de homologação.

Runbooks: [deploy de produção](docs/deploy-producao.md), [operação SaaS](docs/saas-operacao.md), [backup/restauração](docs/backup-restore.md), [resposta a incidentes](docs/incident-response.md), [anexo de operador](docs/data-processing-agreement-template.md) e [checklist de release](docs/release-checklist.md). Os textos legais incluídos no produto precisam de revisão jurídica antes do uso comercial.

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
