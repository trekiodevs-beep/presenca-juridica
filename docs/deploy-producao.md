# Runbook de produção — Presença Jurídica CRM

Este documento descreve o primeiro go-live e os releases seguintes. Execute o primeiro go-live em uma janela controlada, com uma pessoa responsável pelo comando e outra pela validação. Não publique diretamente de uma árvore local suja e não trate build aprovado como prova de funcionamento externo.

## 1. Dados que precisam estar definidos

Preencha estes valores antes de iniciar:

| Variável | Exemplo | Observação |
| --- | --- | --- |
| `PROJECT_ID` | `presenca-juridica-prod` | Projeto Firebase/GCP de produção sob conta corporativa |
| `DATABASE_ID` | `presenca-juridica-prod` | Banco Firestore usado pelo navegador, Admin SDK, gatilhos, Rules e índices |
| `BUCKET_NAME` | `presenca-juridica-prod.firebasestorage.app` | Confirmar no Firebase Console |
| `APP_URL` | `https://crm.seudominio.com.br` | Sem barra final |
| `EMAIL_FROM` | `Presença Jurídica <noreply@seudominio.com.br>` | Domínio verificado no Resend |
| `HEALTH_URL` | URL publicada da Function `health` | Copiar da saída do deploy; não presumir |
| `WEBHOOK_URL` | URL publicada da Function `asaasWebhook` | Copiar da saída do deploy; não usar redirecionamento |

O checkout atual está precificado em R$ 149/mês no Essencial e R$ 249/mês no Profissional. Confirme comercialmente esses valores antes do go-live.

### Decisão obrigatória sobre o Firebase

O checkout atual aponta para:

- projeto `gen-lang-client-0108521604`;
- banco nomeado `ai-studio-crmpresenajurdic-84f41a05-98d7-43ba-a467-164579af084d`;
- bucket `gen-lang-client-0108521604.firebasestorage.app`.

Para produção, recomenda-se um projeto Firebase dedicado, com faturamento, IAM e recuperação sob contas corporativas. Se um novo projeto for adotado, atualize e revise antes do deploy:

- `.firebaserc`;
- `firebase.json`, principalmente `firestore.database`;
- `firebase-applet-config.json`;
- `functions/.env.<PROJECT_ID>`;
- todas as variáveis `VITE_FIREBASE_*` do Coolify.

`FIRESTORE_DATABASE_ID` e `VITE_FIREBASE_FIRESTORE_DATABASE_ID` devem ser idênticos. Não crie um banco `(default)` por conveniência e não publique Rules no banco errado.

## 2. Pré-requisitos e governança

1. Use Node.js 22, npm, Java 21, Firebase CLI, Google Cloud CLI e Git.
2. Garanta acesso administrativo ao Firebase/GCP, Asaas, Resend, DNS, GitHub e Coolify.
3. Ative faturamento Blaze no projeto Firebase e defina alertas de orçamento.
4. Escolha a região do Firestore antes de criar o banco; essa decisão não deve ser tratada como reversível. As Functions já usam `southamerica-east1`.
5. Restrinja IAM por função e exija MFA nas contas administrativas.
6. Faça revisão jurídica dos Termos, Política de Privacidade, Cookies e anexo de operador antes de aceitar clientes reais.
7. Se já houver dados reais, exporte o Firestore e preserve uma cópia dos objetos do Storage antes do corte.
8. Se já houver escritórios antigos, audite `ownerUserId`, `planCode`, `subscriptionStatus`, `trialEndsAtMs`, `limits` e a membership do proprietário. Não faça o corte enquanto houver cadastros antigos sem regularização.

## 3. Consolidar o código no GitHub

No PowerShell, a partir da raiz do repositório:

```powershell
git status --short --branch
git diff --check
git diff --stat
npm ci
npm --prefix functions ci
npm run validate
npm run test:rules
npm audit --omit=dev
```

`npm run test:rules` exige Java 21. Todos os comandos acima são gates; não prossiga com falha. Depois:

1. revise o diff completo e confirme que não há segredo;
2. crie uma branch `codex/release-saas-producao`;
3. faça commit somente dos arquivos revisados;
4. envie a branch ao GitHub e abra um pull request;
5. aguarde o workflow `CI` concluir com sucesso;
6. aprove e faça merge em `main`;
7. anote o SHA de `main` que será promovido.

Não habilite o auto-deploy do Coolify ainda.

## 4. Preparar Firebase, Auth e App Check

No Firebase Console:

1. confirme o projeto, plano Blaze e proprietários;
2. crie/confirme o banco Firestore com o `DATABASE_ID` exato;
3. crie/confirme o Web App e copie sua configuração;
4. ative o provedor Google em Authentication;
5. configure e-mail de suporte e adicione `crm.seudominio.com.br` em **Authorized domains**;
6. se MFA for obrigatório, atualize Authentication para Identity Platform, habilite regiões SMS, exija e-mail verificado e teste inscrição/recuperação;
7. em App Check, registre o Web App com reCAPTCHA v3 e guarde a chave pública do site para `VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY`;
8. não desative `enforceAppCheck` no código. As callable Functions rejeitam clientes sem token válido;
9. confirme que Cloud Functions, Cloud Build, Artifact Registry, Secret Manager, Eventarc, Pub/Sub e Cloud Scheduler podem ser habilitados pela conta de deploy.

## 5. Preparar Resend e Asaas sandbox

### Resend

1. Adicione um subdomínio de envio, por exemplo `send.seudominio.com.br`.
2. Publique exatamente os registros DKIM, SPF e MX fornecidos pelo Resend.
3. Aguarde o estado `Verified`.
4. Crie uma API key exclusiva para produção.
5. Defina `EMAIL_FROM` com remetente pertencente ao domínio verificado.

### Asaas

1. Comece obrigatoriamente no sandbox.
2. Crie uma API key exclusiva para o ambiente.
3. Gere um token forte e independente para o webhook.
4. Após publicar as Functions, cadastre `WEBHOOK_URL` sem redirecionamentos e use o mesmo token no campo de autenticação.
5. Assine somente estes eventos consumidos pelo código:
   - `PAYMENT_CONFIRMED`;
   - `PAYMENT_RECEIVED`;
   - `PAYMENT_OVERDUE`;
   - `PAYMENT_DUNNING_RECEIVED`;
   - `PAYMENT_REPROVED`;
   - `SUBSCRIPTION_DELETED`;
   - `SUBSCRIPTION_INACTIVATED`.
6. Configure entrega sequencial, se disponível, mas mantenha o teste de evento repetido e fora de ordem: o backend já usa o ID do evento para idempotência e a data do evento para evitar regressão de estado.

## 6. Configurar parâmetros e segredos das Functions

Autentique e confira o alvo:

```powershell
npx firebase login
npx firebase projects:list
npx firebase use PROJECT_ID
npx firebase firestore:databases:list --project PROJECT_ID
```

Crie localmente `functions/.env.PROJECT_ID` — o arquivo é ignorado pelo Git — com:

```env
FIRESTORE_DATABASE_ID="DATABASE_ID"
APP_URL="https://crm.seudominio.com.br"
ASAAS_BASE_URL="https://api-sandbox.asaas.com/v3"
EMAIL_FROM="Presença Jurídica <noreply@seudominio.com.br>"
```

Não omita `ASAAS_BASE_URL`: o default do código é a API de produção.

Cadastre os segredos sem colocá-los no terminal, arquivo `.env` ou Git:

```powershell
npx firebase functions:secrets:set ASAAS_API_KEY --project PROJECT_ID
npx firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN --project PROJECT_ID
npx firebase functions:secrets:set RESEND_API_KEY --project PROJECT_ID
```

O CLI solicitará cada valor interativamente. Uma nova versão de segredo só passa a valer depois do redeploy das Functions que a utilizam.

## 7. Configurar o Storage

Edite uma cópia de `storage.cors.example.json` e deixe somente os domínios efetivamente usados, por exemplo:

```json
[
  {
    "origin": ["https://crm.seudominio.com.br"],
    "method": ["PUT"],
    "responseHeader": ["Content-Type", "x-goog-content-length-range"],
    "maxAgeSeconds": 3600
  }
]
```

Aplique e confira:

```powershell
gcloud auth login
gcloud config set project PROJECT_ID
gcloud storage buckets update gs://BUCKET_NAME --cors-file=CAMINHO_DO_CORS_JSON
gcloud storage buckets describe gs://BUCKET_NAME --format="default(cors_config)"
```

Não abra escrita em `storage.rules`. O navegador envia arquivos por URL assinada emitida pela Function; downloads também usam URLs temporárias.

Para produção, habilite versionamento/soft delete ou uma política equivalente para os binários. O backup lógico implementado guarda metadados dos documentos, não duplica cada binário.

## 8. Publicar o backend na ordem correta

Use o SHA aprovado de `main`. Em uma primeira publicação, faça:

```powershell
git switch main
git pull --ff-only
npm ci
npm --prefix functions ci
npm run validate
npm run test:rules
npx firebase use PROJECT_ID
npx firebase deploy --only "firestore:indexes" --project PROJECT_ID
```

No Console, aguarde todos os índices ficarem prontos. Depois publique as Functions:

```powershell
npx firebase deploy --only "functions" --project PROJECT_ID
```

Copie da saída as URLs reais de `health` e `asaasWebhook`. Teste a saúde:

```powershell
Invoke-WebRequest -UseBasicParsing HEALTH_URL
```

O resultado esperado é HTTP 200 e indicação de banco acessível. Confira também:

- todas as Functions em `southamerica-east1`;
- gatilhos Firestore associados ao `DATABASE_ID` nomeado;
- jobs do Cloud Scheduler criados e habilitados;
- ausência de erro de permissão no Secret Manager/Eventarc;
- logs sem erro de inicialização.

Cadastre e teste o webhook Asaas sandbox. Só então, na janela de corte, publique as Rules:

```powershell
npx firebase deploy --only "firestore:rules,storage" --project PROJECT_ID
```

As Rules locais substituem as regras remotas. Confirme no Console que o banco correto recebeu `firestore.rules` e que o Storage ficou com negação direta.

## 9. Configurar e publicar o frontend no Coolify

Crie uma Application no Coolify:

- Source: GitHub App com acesso apenas ao repositório necessário;
- Repository: `MatheusMartins33/CRM---Presen-a-Juridica`;
- Branch: `main`;
- Build Pack: `Dockerfile`;
- Base directory: `/`;
- Dockerfile: `/Dockerfile`;
- porta interna: `80`;
- domínio: `https://crm.seudominio.com.br`;
- Force HTTPS: habilitado;
- Healthcheck: `GET /`, resposta `200`;
- Auto Deploy: desabilitado durante o primeiro go-live.

Cadastre estas variáveis como **Build Variables**, porque o Vite as incorpora no bundle:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=BUCKET_NAME
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_FIRESTORE_DATABASE_ID=DATABASE_ID
VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY=...
VITE_FUNCTIONS_HEALTH_URL=HEALTH_URL
VITE_USE_MOCK_DATA=false
```

As chaves públicas Firebase/reCAPTCHA não substituem segurança por Rules e App Check. Nenhum segredo Asaas ou Resend pertence ao Coolify.

Faça um deploy manual, confira se o Coolify construiu exatamente o SHA aprovado e valide:

```powershell
Invoke-WebRequest -UseBasicParsing https://crm.seudominio.com.br/
Invoke-WebRequest -UseBasicParsing HEALTH_URL
```

Depois confirme certificado TLS, redirecionamento HTTP→HTTPS, assets, rotas SPA e ausência de erro no console do navegador.

## 10. Homologação externa obrigatória

Use contas e escritórios descartáveis. Registre evidências, horários, IDs de eventos e resultados.

1. **Acesso:** login Google, logout, domínio autorizado, aceite legal versionado, MFA e recuperação.
2. **Trial:** novo escritório nasce em `TRIALING`, com 15 dias, proprietário/membership e limites corretos.
3. **Onboarding:** conclua todos os passos e confirme persistência após novo login.
4. **Multi-tenant:** crie dois escritórios e prove que cada conta recebe `permission-denied` ao tentar ler/escrever IDs do outro.
5. **Papéis:** valide owner, admin, lawyer, assistant, finance e read; teste remoção, bloqueio e transferência de propriedade.
6. **Convites:** enviar, reenviar, revogar, expirar, aceitar com e-mail correto e recusar e-mail diferente.
7. **Contatos e operações:** lead interno, lead público, evento inicial atômico, tarefas, agenda e financeiro.
8. **Limites:** recusar o 101º contato no trial, usuário excedente, reserva simultânea e upload além da cota.
9. **Documentos:** reservar upload, enviar por URL assinada, finalizar, baixar internamente, publicar no portal e baixar no portal; repetir após expiração da URL.
10. **Portal:** token válido, inativo e expirado; nenhum dado de outro escritório.
11. **Cobrança sandbox:** checkout hospedado, Pix, boleto, cartão, confirmação, atraso, cinco dias de graça, suspensão, regularização, mudança de plano e cancelamento.
12. **Webhook:** token inválido, evento duplicado, evento antigo e falha transitória; o Asaas deve receber HTTP 200 somente quando processado/ignorado com segurança.
13. **E-mail:** convite, avisos de trial e estados de cobrança chegam e não expõem dados sensíveis.
14. **LGPD:** exportação, protocolo, agendamento/cancelamento de exclusão e trilha de auditoria.
15. **Suporte:** solicitação, aprovação, leitura limitada, expiração em 60 minutos e revogação.
16. **Backup:** aguarde um backup real, baixe-o, valide hash/manifesto e restaure em outro projeto com o comando documentado em `docs/backup-restore.md`.
17. **Operação:** página `/status`, `health`, logs, jobs agendados e alertas externos.

O release é **no-go** se falhar isolamento, cobrança, documento, backup/restauração ou se algum item usar dados mock.

## 11. Virada do Asaas para produção

Somente depois de toda a homologação sandbox:

1. crie API key e token de webhook novos na conta Asaas de produção;
2. atualize os segredos Firebase;
3. troque `ASAAS_BASE_URL` em `functions/.env.PROJECT_ID` para `https://api.asaas.com/v3`;
4. publique novamente as Functions;
5. cadastre o `WEBHOOK_URL` na conta de produção com o novo token;
6. teste autenticação inválida e entrega válida;
7. crie uma assinatura real controlada e confirme o ciclo financeiro no Asaas e no Firestore;
8. não reutilize IDs de cliente, assinatura, pagamento ou webhook do sandbox.

Comandos de rotação e publicação:

```powershell
npx firebase functions:secrets:set ASAAS_API_KEY --project PROJECT_ID
npx firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN --project PROJECT_ID
npx firebase deploy --only "functions" --project PROJECT_ID
```

## 12. Observabilidade e rotina operacional

Antes de abrir vendas:

- crie monitor externo para `APP_URL`, `/status` e `HEALTH_URL`;
- configure alertas de Functions por exceção, HTTP 5xx, latência e execução de scheduler;
- configure orçamento e alertas de custos no GCP;
- monitore `integrationErrors`, `billingEvents`, `auditLogs`, `supportTickets` e `privacyRequests`;
- verifique diariamente a fila/log do webhook Asaas; após falhas consecutivas ela pode ser interrompida;
- defina responsáveis e SLA para suporte, privacidade, cobrança e incidentes;
- ensaie restauração periodicamente em ambiente separado;
- preserve logs e evidências seguindo `docs/incident-response.md`.

Após 24–48 horas estáveis, habilite Auto Deploy apenas se o fluxo garantir que `main` só recebe merge com CI verde. O primeiro piloto deve ser limitado a poucos escritórios acompanhados.

## 13. Rollback

Antes do go-live, registre o SHA anterior, salve as versões anteriores das Rules e confirme que a imagem anterior ainda existe no Coolify.

Em incidente:

1. declare o incidente e congele novos deploys;
2. no Coolify, faça rollback para a imagem local anterior saudável;
3. para Functions, faça checkout do SHA anterior em uma branch de emergência, compile e redeploy; não apague dados;
4. para Rules, publique os arquivos versionados do SHA anterior somente após avaliar se isso reabre acesso indevido;
5. se o problema for cobrança, interrompa novos checkouts e preserve os eventos; não marque pagamentos manualmente sem conciliação;
6. rotacione segredos comprometidos e redeploy as Functions consumidoras;
7. restaure dados somente após reproduzir e validar a restauração em projeto separado;
8. valide novamente a jornada afetada no ambiente real antes de encerrar o incidente.

Rollback de frontend não reverte Firestore, pagamentos ou objetos. Migrações e correções de dados devem ser aditivas e auditadas.

## 14. Checklist final de go-live

- [ ] SHA aprovado e CI verde.
- [ ] Projeto, banco nomeado e bucket conferidos por duas pessoas.
- [ ] Build sem mock e App Check ativo.
- [ ] Rules e índices publicados no banco correto.
- [ ] Segredos e remetente Resend validados.
- [ ] CORS restrito ao domínio real.
- [ ] Asaas sandbox integralmente aprovado.
- [ ] Backup e restauração ensaiados fora de produção.
- [ ] Isolamento de dois tenants comprovado.
- [ ] Coolify serve o SHA aprovado com HTTPS e healthcheck saudável.
- [ ] Asaas produção validado com transação controlada.
- [ ] Alertas, responsáveis e rollback preparados.
- [ ] Textos jurídicos aprovados.
- [ ] Piloto controlado autorizado.

Somente marque o ambiente como produção quando todos os itens acima tiverem evidência externa. Código publicado, serviço implantado e jornada comprovada são estados diferentes.
