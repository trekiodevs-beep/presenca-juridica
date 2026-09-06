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
VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_STORAGE_BUCKET=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_APP_ID=""
VITE_FIREBASE_FIRESTORE_DATABASE_ID=""
VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY=""
VITE_USE_MOCK_DATA="false"
```

Observacoes:

- As variaveis `VITE_*` sao lidas no build do Vite. No Coolify, configure-as antes do primeiro deploy.
- Depois de associar o dominio no Coolify, adicione esse dominio em Firebase Auth > Authorized domains.
- Publique `firestore.rules` e `storage.rules` no Firebase antes de liberar clientes reais.
- O app usa o banco Firestore nomeado definido em `firebase-applet-config.json`. O navegador não acessa o Storage diretamente: uploads e downloads usam URLs assinadas curtas emitidas pelas Functions após validação no mesmo banco; `storage.rules` nega tudo por padrão.

## Camada SaaS

O repositório contém a primeira implementação comercial completa da camada SaaS:

- planos `trial`, `essential`, `professional` e `custom`, com limites e permissões tipados;
- estados de assinatura `TRIALING`, `ACTIVE`, `PAST_DUE`, `GRACE_PERIOD`, `SUSPENDED` e `CANCELED`;
- bloqueio real de mutações no cliente e nas Firestore Rules quando o acesso é somente leitura;
- tela de Plano e cobrança, equipe, convite por token hash e aceitação vinculada ao e-mail autenticado;
- Cloud Functions para checkout/troca/cancelamento, cobranças e 2ª via, webhook Asaas transacional, reconciliação, avisos de trial e limites atômicos de usuários, contatos e armazenamento;
- auditoria de ações sensíveis e índices Firestore versionados.
- MFA opcional, documentos legais/aceite versionado, solicitações LGPD, suporte com consentimento temporário e backup/restauração.

### Publicação das Functions

As Functions usam Node 22 e o banco indicado por `FIRESTORE_DATABASE_ID`. Antes de publicar:

```bash
cd functions
npm install
npm run build
```

Configure no Firebase os segredos `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `RESEND_API_KEY`. Configure também `APP_URL`, `ASAAS_BASE_URL` (`https://api-sandbox.asaas.com/v3` em homologação) e `FIRESTORE_DATABASE_ID`. No frontend, configure `VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY`; as callable Functions exigem App Check.

Para uploads no navegador, substitua o domínio de exemplo em `storage.cors.example.json` e aplique o CORS no bucket. Não libere escrita em `storage.rules`.

O webhook público deve apontar para `asaasWebhook` e usar o cabeçalho `asaas-access-token`. A criação de cobrança usa os preços presentes em `src/lib/plans.ts` como hipótese inicial de validação; eles devem ser confirmados antes do piloto.

### Limites e dados existentes

Escritórios criados a partir desta versão recebem `planCode`, `limits`, `trialEndsAtMs` e membership do proprietário no mesmo batch. Escritórios antigos precisam passar pelo fluxo de migração/regularização do trial antes que as novas Rules permitam alterações; isso é deliberado para evitar liberar acesso comercialmente expirado por ausência de data numérica.

O build e os testes locais não comprovam publicação, credenciais Asaas, configuração de App Check, banco nomeado, regras remotas, webhook recebido, e-mail enviado ou restauração de backup. Esses itens continuam sendo gates de homologação.

Runbooks: [deploy de produção](docs/deploy-producao.md), [operação SaaS](docs/saas-operacao.md), [backup/restauração](docs/backup-restore.md), [resposta a incidentes](docs/incident-response.md), [anexo de operador](docs/data-processing-agreement-template.md) e [checklist de release](docs/release-checklist.md). Os textos legais incluídos no produto precisam de revisão jurídica antes do uso comercial.

## Checklist antes de divulgar

- Build de producao concluido.
- App publicado em dominio estavel.
- Dominio autorizado no Firebase Auth.
- Firestore e Storage validados fora do modo mock.
- Criacao de escritorio validada.
- Lead publico validado.
- Upload de documento validado.
- Portal do cliente validado.
- Isolamento entre escritorios validado.
