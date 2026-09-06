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
VITE_USE_MOCK_DATA="false"
```

Observacoes:

- As variaveis `VITE_*` sao lidas no build do Vite. No Coolify, configure-as antes do primeiro deploy.
- Depois de associar o dominio no Coolify, adicione esse dominio em Firebase Auth > Authorized domains.
- Publique `firestore.rules` e `storage.rules` no Firebase antes de liberar clientes reais.
- O app está configurado para usar o banco Firestore nomeado definido em `firebase-applet-config.json`. As regras do Storage usam `firestore.get/exists`, que só consultam o banco `(default)`; valide essa arquitetura no projeto Firebase antes de habilitar upload de documentos em produção.

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
