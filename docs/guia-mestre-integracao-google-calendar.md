# Guia mestre de integração com Google Calendar

> Referência técnica reutilizável para aplicações web SaaS, com OAuth 2.0, Google Login, Google Calendar API, sincronização bidirecional, Supabase/PostgreSQL, segurança, verificação do Google e operação em produção.

## 1. Objetivo e limites

Este documento descreve como projetar, implementar, validar e operar uma integração profissional com o Google Calendar. Ele serve como norte para novos softwares e não depende do CRM Presença Jurídica, embora incorpore aprendizados comprovados nesse projeto.

O guia cobre:

- login com Google e autorização do Calendar como fluxos distintos;
- configuração do projeto no Google Cloud;
- OAuth 2.0 server-side com refresh token;
- seleção de agenda e sincronização bidirecional;
- isolamento multi-tenant;
- armazenamento seguro de credenciais;
- idempotência, fila, retry, conflitos e exclusões;
- webhooks, `syncToken` e reconciliação;
- experiência do usuário e mensagens de erro;
- verificação pública do aplicativo pelo Google;
- testes, implantação, observabilidade, rollback e suporte.

Não trate presença de código, build verde ou Function publicada como prova de integração. Os gates são independentes:

1. contrato e código existem;
2. código compila e testes locais passam;
3. migrations e Functions estão publicadas;
4. secrets e OAuth client de produção estão corretos;
5. fluxo autenticado funciona com uma conta Google real;
6. sincronização de ida e volta foi demonstrada;
7. aplicativo foi aprovado pelo Google, quando aplicável;
8. scheduler, webhook e alertas operam continuamente.

## 2. Decisão inicial: autenticação não é autorização

“Entrar com Google” e “Conectar Google Agenda” resolvem problemas diferentes.

| Fluxo | Finalidade | Callback típico | Tokens |
|---|---|---|---|
| Google Login | Identificar o usuário na aplicação | `/auth/v1/callback` ou callback do provedor de autenticação | sessão da aplicação |
| Google Calendar | Autorizar acesso aos calendários | `/functions/v1/calendar-oauth-callback` ou endpoint backend equivalente | access token e refresh token Google |

Não reutilize cegamente o callback do login no fluxo do Calendar. É possível usar o mesmo projeto Google Cloud, mas cada fluxo deve ter contrato, callback, scopes e tratamento de estado explícitos. Para ambientes com ciclo de vida independente, prefira projetos/clientes OAuth separados.

## 3. Arquitetura de referência

```text
Navegador
  ├─ sessão da aplicação (JWT)
  ├─ iniciar conexão ───────────────► OAuth Start autenticado
  │                                     ├─ valida usuário e tenant
  │                                     ├─ persiste state descartável
  │                                     └─ devolve URL do Google
  └─ redirecionamento Google ◄────── OAuth Callback público
                                        ├─ valida state
                                        ├─ troca code por tokens
                                        ├─ cifra refresh token
                                        └─ redireciona para a aplicação

CRM/App ─► banco transacional ─► outbox ─► worker ─► Google Calendar API
Google ─► webhook ─► pedido de reconciliação ─► syncToken ─► banco transacional
```

Princípios obrigatórios:

- o frontend nunca recebe client secret, refresh token ou chave administrativa;
- salvar um compromisso local não depende da disponibilidade do Google;
- toda operação externa é idempotente;
- o tenant é obtido de uma relação autorizada, não de um campo editável do cliente;
- webhooks apenas sinalizam mudança; a reconciliação consulta a API;
- conflitos relevantes não são sobrescritos silenciosamente;
- logs permitem localizar o estágio da falha sem expor segredos.

## 4. Preparação no Google Cloud

### 4.1 Separar ambientes

Crie projetos Google Cloud separados para desenvolvimento, homologação e produção. No mínimo, use clientes OAuth diferentes. Não misture callbacks localhost no cliente de produção.

Exemplo:

```text
meu-produto-dev
meu-produto-staging
meu-produto-prod
```

### 4.2 Ativar a API

No projeto correto:

1. abra **APIs e serviços**;
2. ative **Google Calendar API**;
3. configure o Google Auth Platform;
4. defina o público como interno ou externo conforme o produto;
5. cadastre contatos monitorados pela equipe.

### 4.3 Branding e domínio

Cadastre:

- nome real do produto;
- logo que aparece no software;
- homepage pública, informativa e acessível sem login;
- política de privacidade pública em HTML;
- termos de serviço públicos;
- e-mail de suporte e contato do desenvolvedor;
- apenas domínios realmente controlados.

A homepage não deve ser somente uma tela de login. Ela deve explicar o produto e apontar claramente para a política de privacidade e os termos.

#### Regra operacional para identidade e homepage

O nome exibido no Google Auth Platform deve corresponder exatamente à identidade visível na homepage enviada para análise. Não basta que o nome exista no `<title>`: ele deve aparecer no conteúdo renderizado, junto da descrição do produto. O mesmo cuidado vale para logo, domínio, e-mail de suporte, política de privacidade e termos.

Se a aplicação usa uma rota de login como homepage, essa rota precisa continuar publicamente acessível sem autenticação e conter, antes do botão de entrada, a identificação do produto, sua finalidade e o uso dos dados Google. Se a página depender de login para explicar o produto, use uma homepage institucional pública diferente.

Quando houver reprovação de branding:

1. registre o nome aprovado no Google e o texto efetivamente exibido em produção;
2. alinhe o texto, a logo e os links no código e publique a alteração;
3. valide a URL em janela anônima, confirmando nome, finalidade, política e termos;
4. atualize o rascunho na página **Branding** do Google Auth Platform;
5. salve, prepare para verificação e publique o branding quando o Google liberar essa ação;
6. reenvie a verificação somente depois de confirmar que a versão pública e a configuração do Google são iguais.

Não considere um commit ou um build como evidência de correção: a página pública publicada e o branding publicado no Google são gates independentes.

### 4.4 Cliente OAuth Web

Crie um cliente do tipo **Aplicativo da Web**.

Origem JavaScript autorizada:

```text
https://app.exemplo.com
```

Não inclua caminho, barra final desnecessária ou wildcard.

URI de redirecionamento autorizado:

```text
https://API_OU_FUNCTION_HOST/functions/v1/calendar-oauth-callback
```

O URI precisa coincidir exatamente com o enviado no parâmetro `redirect_uri` e com o usado na troca do código. Protocolo, host, porta, caminho e barra final fazem parte da comparação.

Erros comuns:

```text
api.exemplo.com/functions/v1/calendar-oauth-callback       # sem https://
https://api.exemplo.com/auth/v1/callback                   # callback do login
http://127.0.0.1:54321/...                                 # localhost no cliente prod
https://api.exemplo.com/functions/v1/calendar-oauth-callbac # slug truncado
```

### 4.5 Escopos mínimos

Para listar agendas e ler/escrever eventos, uma combinação comum é:

```text
openid
email
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

Solicite apenas o que o produto usa. Não use `.../auth/calendar` se `calendar.events` for suficiente. Se a aplicação só cria eventos em calendários que ela própria criou, avalie `calendar.app.created`. A escolha deve ser revisada contra o comportamento real e a documentação atual do Google.

## 5. Configuração segura

### 5.1 Variáveis de backend

```text
GOOGLE_CALENDAR_CLIENT_ID
GOOGLE_CALENDAR_CLIENT_SECRET
GOOGLE_CALENDAR_REDIRECT_URI
CALENDAR_TOKEN_ENCRYPTION_KEY
CALENDAR_SYNC_WORKER_SECRET
GOOGLE_CALENDAR_WEBHOOK_TOKEN
APP_URL
```

Em Supabase, também são usados no backend:

```text
SUPABASE_URL
SUPABASE_ANON_KEY ou publishable key, conforme o SDK
SUPABASE_SERVICE_ROLE_KEY ou secret key
```

Nunca crie variantes `VITE_*`, `NEXT_PUBLIC_*` ou equivalentes para segredos. Variáveis públicas são incorporadas ao bundle.

### 5.2 Chave de criptografia

Gere 32 bytes aleatórios e armazene-os em base64:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Use AES-256-GCM com IV aleatório de 12 bytes. Armazene `versão.iv.ciphertext` ou envelope equivalente. Planeje rotação com `key_version`; não substitua a chave sem migrar os tokens existentes.

### 5.3 Matriz de exposição

| Dado | Frontend | Backend | Banco |
|---|---:|---:|---:|
| Client ID | permitido | permitido | opcional |
| Client secret | proibido | secret manager | proibido em texto claro |
| Access token | evitar | memória temporária | somente se necessário e cifrado |
| Refresh token | proibido | descriptografado apenas durante uso | cifrado |
| Chave administrativa | proibido | secret manager | não aplicável |
| Chave de criptografia | proibido | secret manager | proibido |

## 6. Modelo de dados mínimo

### 6.1 Estados OAuth

```sql
create table calendar_oauth_states (
  state uuid primary key,
  user_id uuid not null,
  tenant_id uuid not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
```

Regras:

- expiração curta, normalmente 5 a 10 minutos;
- uso único;
- sem acesso direto pelo cliente;
- limpeza periódica de registros expirados;
- vinculação ao usuário e tenant validados antes do redirecionamento.

### 6.2 Conexões

```sql
create table calendar_connections (
  id uuid primary key,
  tenant_id uuid not null,
  user_id uuid not null,
  provider text not null default 'google',
  google_account_email text,
  encrypted_refresh_token text not null,
  encryption_key_version integer not null default 1,
  granted_scopes text[] not null default '{}',
  calendar_id text,
  calendar_name text,
  status text not null,
  calendar_sync_token text,
  webhook_channel_id text,
  webhook_resource_id text,
  webhook_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  connection_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, provider)
);
```

### 6.3 Eventos, outbox e execuções

O evento local precisa manter identidade local e remota:

```text
tenant_id
origin: app | google | linked
external_calendar_id
external_event_id
google_etag
google_updated_at
sync_status
sync_error_code
last_local_change_at
last_remote_change_at
last_synced_at
deleted_at
version
```

A outbox deve conter:

```text
tenant_id, event_id, operation, version, status,
attempts, available_at, locked_at, last_error, dead_lettered_at
```

Crie unicidade para impedir duas pendências abertas da mesma operação/versão. Reserve lotes com `FOR UPDATE SKIP LOCKED`.

Registre cada execução em `calendar_sync_runs`, com origem manual/scheduler/webhook, duração, contadores e resumo de erro.

## 7. Fluxo OAuth completo

### 7.1 Iniciar autorização

Contrato recomendado:

```http
POST /calendar/oauth/start
Authorization: Bearer <JWT da aplicação>
```

Sequência:

1. rejeitar ausência de autenticação com `401`;
2. validar sessão no servidor;
3. resolver o tenant por vínculo ativo e autorizado;
4. rejeitar pré-condição de negócio ausente com `412`;
5. gerar `state` criptograficamente aleatório;
6. persistir `state`, usuário, tenant, callback e expiração;
7. montar URL de autorização;
8. devolver a URL ao frontend.

Parâmetros essenciais:

```text
client_id=<client id>
redirect_uri=<callback exato>
response_type=code
access_type=offline
prompt=consent
scope=<scopes separados por espaço>
state=<valor aleatório>
```

`access_type=offline` solicita capacidade de renovação. O Google pode não devolver um novo refresh token em autorizações subsequentes. Não destrua um refresh token válido se a nova resposta não trouxer outro; quando for indispensável obter um novo, revogue a concessão anterior e execute novo consentimento.

### 7.2 Callback

Contrato:

```http
GET /calendar/oauth/callback?state=...&code=...
```

O callback deve ser público para o Google, mas seguro pela validação de `state`.

Sequência:

1. tratar `error` retornado pelo Google, inclusive `access_denied`;
2. exigir `state` e `code`;
3. buscar `state` não consumido e não expirado;
4. trocar `code` no endpoint `https://oauth2.googleapis.com/token`;
5. usar o mesmo `redirect_uri` persistido no início;
6. validar resposta, scopes e presença de credenciais necessárias;
7. consultar `userinfo` somente se o e-mail for necessário;
8. cifrar o refresh token;
9. fazer upsert da conexão no tenant correto;
10. consumir o `state` de maneira atômica;
11. redirecionar com HTTP `303` para uma rota conhecida da aplicação;
12. definir `Cache-Control: no-store`.

Não devolva stack trace ao navegador. Use resultados estáveis:

```text
/settings?calendar=connected
/settings?calendar=access_denied
/settings?calendar=invalid_state
/settings?calendar=token_error
/settings?calendar=not_configured
/settings?calendar=server_error
```

### 7.3 Concorrência do state

O consumo ideal é atômico:

```sql
update calendar_oauth_states
set consumed_at = now()
where state = :state
  and consumed_at is null
  and expires_at > now()
returning *;
```

Se não houver retorno, o estado é inválido, expirou ou foi reutilizado. Isso bloqueia replay e duas abas tentando concluir o mesmo fluxo.

## 8. Seleção da agenda

Depois de conectar:

1. renove o access token no backend;
2. consulte `GET /calendar/v3/users/me/calendarList`;
3. exponha ao frontend apenas ID, nome, principal, acesso e timezone;
4. valide no backend que a agenda escolhida pertence à lista autorizada;
5. salve `calendar_id` e `calendar_name`;
6. zere o `syncToken` quando trocar de agenda;
7. encerre o canal antigo e registre um novo `events.watch`.

Não confie em um `calendarId` recebido do navegador sem validá-lo.

## 9. Sincronização da aplicação para o Google

Use outbox transacional:

1. a transação salva o evento local;
2. um trigger `AFTER INSERT/UPDATE` enfileira a referência depois que o pai existe;
3. o worker reserva o lote;
4. renova access token;
5. transforma o modelo local no payload Google;
6. executa `events.insert`, `events.patch` ou `events.delete`;
7. persiste ID externo, `etag`, timestamps e snapshot;
8. conclui a pendência.

Se a outbox possui FK para o evento, não a insira antes do registro pai existir. Calcule metadados em `BEFORE`, mas enfileire em `AFTER`.

### 9.1 Idempotência

- associe um ID remoto ao evento local;
- derive IDs determinísticos quando a API permitir;
- use versão local na chave da pendência;
- trate repetição do mesmo trabalho como sucesso;
- após timeout desconhecido, consulte o remoto antes de criar novamente;
- nunca use somente título e horário para deduplicar.

### 9.2 Concorrência e conflitos

Envie `If-Match: <etag>` em atualizações e exclusões quando aplicável. Um `412 Precondition Failed` do Google indica alteração concorrente, não “usuário sem escritório”. Registre conflito e preserve snapshots dos dois lados.

## 10. Sincronização do Google para a aplicação

### 10.1 Carga inicial

1. execute `events.list` com parâmetros definidos e paginação;
2. processe todas as páginas;
3. persista `nextSyncToken` somente na última página e após aplicar o lote;
4. associe por `external_event_id`;
5. preserve eventos cancelados/deletados conforme a política local.

### 10.2 Cargas incrementais

Nas execuções seguintes, envie o `syncToken` anterior. Mantenha o mesmo conjunto de parâmetros compatíveis usado na carga inicial. Trocar filtros pode invalidar a semântica da sincronização.

Se o Google retornar `410 Gone`:

1. invalide somente o `syncToken` daquela conexão;
2. faça nova sincronização completa controlada;
3. não apague eventos locais indiscriminadamente;
4. reconcilie IDs e estados;
5. salve um novo token após sucesso.

### 10.3 Normalização

Defina uma representação canônica para:

- eventos com hora e eventos de dia inteiro;
- timezone IANA;
- início e fim;
- recorrência e exceções;
- status `confirmed`, `tentative` e `cancelled`;
- participantes;
- descrição, local e conferência;
- visibilidade e transparência;
- anexos, se suportados.

Não transforme participantes em clientes/leads automaticamente. Isso exige regra de negócio e consentimento próprios.

## 11. Webhooks e canais

Registre `events.watch` para a agenda selecionada. Guarde:

```text
channel_id
resource_id
calendar_id
token de validação
expiration
connection_version
```

No webhook:

1. aceite apenas HTTPS;
2. valide channel ID, resource ID e token;
3. associe a uma conexão ativa;
4. rejeite canal expirado ou versão antiga;
5. registre o recebimento de forma idempotente;
6. enfileire reconciliação;
7. responda rapidamente com `2xx`.

A notificação não contém o evento alterado. Ela é um sinal para consultar a API. Canais expiram e precisam ser renovados por scheduler; não existe renovação automática.

## 12. Retry, limites e dead-letter

Classifique falhas:

| Classe | Exemplos | Ação |
|---|---|---|
| permanente de entrada | payload inválido, calendário sem permissão | falhar e exigir ação |
| autenticação | `invalid_grant`, revogação | marcar conexão e pedir reconexão |
| concorrência | `409`, `412` | reconciliar ou abrir conflito |
| transitória | `429`, `500`, `502`, `503`, `504` | retry com backoff e jitter |
| sync inválido | `410` com sync token | sincronização completa |

Use backoff exponencial com jitter e limite. Exemplo conceitual:

```text
delay = min(maxDelay, base * 2^attempt) + random(0, jitter)
```

Após o limite, mova para dead-letter lógico, preserve erro sanitizado e disponibilize reprocessamento operacional.

## 13. Segurança multi-tenant

O tenant nunca deve vir apenas de `tenantId` enviado pelo navegador ou de um perfil desatualizado. Resolva-o por uma associação ativa:

```text
memberships.user_id = usuário autenticado
memberships.status = active
memberships.tenant_id = tenant operacional
```

Regras adicionais:

- RLS para eventos, conexões e execuções;
- tabela de estados OAuth sem acesso do cliente;
- outbox e tokens acessíveis apenas ao backend;
- chave administrativa usada somente depois de autenticar e autorizar o chamador;
- papéis explícitos para conectar, trocar agenda, desconectar e resolver conflitos;
- auditoria de conexão, reconexão, revogação e mudança de agenda.

## 14. Autenticação de endpoints

| Endpoint | Autenticação |
|---|---|
| OAuth start | JWT do usuário |
| OAuth callback | público + state de uso único |
| status/list/select/sync-now | JWT do usuário + autorização tenant |
| worker/reconcile programado | segredo service-to-service |
| webhook Google | público + cabeçalhos/canal/token validados |

Em Supabase, endpoints chamados pelo usuário normalmente mantêm verificação JWT. Webhooks e callbacks públicos precisam de `verify_jwt = false`, mas devem implementar sua própria verificação. Workers não devem aceitar um segredo em query string; use header e comparação constante quando possível.

## 15. Experiência do usuário

### 15.1 Estados visíveis

```text
Não conectado
Conectando
Conectado a conta@exemplo.com
Agenda não selecionada
Sincronizando
Sincronizado em <data/hora>
Com pendências
Conflito requer revisão
Autorização expirada; reconecte
```

Não mostre `FunctionsHttpError`, status HTTP cru, nome de tabela, worker ou stack trace. Traduza códigos técnicos para ações do usuário e preserve o detalhe técnico apenas em logs correlacionados.

Exemplos:

| Código interno | Mensagem ao usuário |
|---|---|
| `CALENDAR_NOT_CONNECTED` | Conecte uma conta Google para sincronizar seus compromissos. |
| `CALENDAR_NOT_SELECTED` | Escolha a agenda que receberá os compromissos. |
| `AUTH_REVOKED` | O acesso ao Google foi revogado. Reconecte sua agenda. |
| `SYNC_PARTIAL` | Alguns compromissos não foram sincronizados. Tente novamente. |
| `CONFLICT` | Este compromisso foi alterado nos dois sistemas e precisa ser revisado. |

### 15.2 Botão Sincronizar agora

O botão deve:

- impedir cliques concorrentes;
- criar uma execução rastreável;
- processar lote limitado;
- retornar rapidamente;
- mostrar progresso e resultado consolidado;
- não prometer conclusão se apenas enfileirou trabalho.

## 16. Diagnóstico por status e sintoma

### `401 Unauthorized`

- sessão ausente/expirada;
- `Authorization` não contém JWT do usuário;
- API key enviada como bearer token;
- gateway rejeitou antes de chegar à Function.

### `403 Forbidden`

- usuário autenticado sem permissão;
- worker secret incorreto;
- política/RLS bloqueando;
- Google recusou scope ou permissão do calendário.

### `412 Precondition Failed`

O significado depende da camada:

- aplicação: pré-requisito de negócio, como tenant/agenda ausente;
- Google: `etag`/`If-Match` inválido por alteração concorrente.

Nunca traduza todos os `412` para a mesma mensagem.

### `invalid_state`

- callback antigo publicado;
- state expirado ou já consumido;
- banco/ambiente diferente entre start e callback;
- duas tentativas concorrentes;
- persistência falhou.

### `redirect_uri_mismatch`

Compare literalmente:

1. URI do Google Cloud;
2. secret/configuração do backend;
3. URI persistido no state;
4. URI enviado na troca de token.

### `NOT_FOUND: Requested function was not found`

- protocolo ausente;
- nome da Function incorreto;
- projeto Supabase errado;
- Function não publicada;
- navegador foi redirecionado para `/functions/v1/https://...` ou caminho concatenado incorretamente.

Teste o endpoint diretamente e verifique `Location` do callback. Um callback sem parâmetros deve redirecionar para um erro controlado, não retornar 500 bruto.

### Refresh token ausente

- consentimento anterior já concedido;
- `access_type=offline` ausente;
- política de consentimento não forçou nova concessão;
- aplicação sobrescreveu token válido por valor vazio.

### Conecta, mas não sincroniza

- nenhuma agenda selecionada;
- scheduler inexistente;
- worker secret divergente;
- outbox sem trigger ou presa em lock;
- FK da outbox executada antes do pai;
- conexão ativa em outro tenant;
- refresh token não descriptografa após troca de chave.

## 17. Observabilidade

Inclua em cada log:

```text
request_id / correlation_id
function
stage
tenant_id anonimizado ou interno
connection_id
sync_run_id
event_id local
status HTTP externo
Google reason/code
attempt
duration_ms
```

Nunca registre:

- authorization code;
- access/refresh token;
- client secret;
- chave de criptografia;
- corpo completo de evento quando houver dados pessoais desnecessários.

Métricas mínimas:

- conexões ativas, em erro e revogadas;
- idade da pendência mais antiga;
- itens pending/processing/failed/dead-letter;
- taxa e duração das sincronizações;
- `401`, `403`, `410`, `412`, `429` e `5xx` externos;
- canais próximos da expiração;
- última reconciliação por tenant.

## 18. Verificação pública pelo Google

Aplicações externas que solicitam scopes sensíveis precisam passar pela verificação aplicável.

Prepare:

- homepage pública que descreva o produto;
- link visível para política de privacidade;
- termos de serviço;
- política explicando acesso, uso, armazenamento, compartilhamento, retenção e exclusão dos dados Google;
- declaração de conformidade com Limited Use;
- domínios verificados e controlados;
- justificativa individual para cada scope;
- vídeo não listado mostrando o fluxo completo.

O vídeo deve mostrar:

1. identidade do aplicativo submetido;
2. início do OAuth;
3. tela completa de consentimento e scopes;
4. ação no produto que usa cada scope;
5. listagem/seleção da agenda, se solicitada;
6. criação/edição/sincronização de evento;
7. como desconectar ou revogar acesso;
8. resultado visível no Google Calendar e no produto.

Depois do envio, monitore o contato do projeto, spam e Central de Verificação. Não altere nome, domínios, URLs, scopes ou cliente durante a análise sem necessidade, pois isso pode exigir nova avaliação.

## 19. Testes obrigatórios

### 19.1 Unitários

- normalização de timezone e dia inteiro;
- mapeamento de status;
- cifrar/descriptografar token;
- chave base64 e base64url;
- cálculo de retry;
- detecção de conflito;
- sanitização de logs e mensagens.

### 19.2 Integração backend/banco

- state expira e só pode ser consumido uma vez;
- tenant é resolvido por membership ativa;
- RLS bloqueia outro tenant;
- trigger cria uma única pendência;
- `SKIP LOCKED` impede reserva duplicada;
- retry reabre item sem duplicar evento;
- dead-letter preserva rastreabilidade;
- troca de agenda invalida sync token/canal anterior.

### 19.3 Contrato HTTP

- métodos inválidos retornam `405`;
- ausência de JWT retorna `401`;
- pré-condição de negócio retorna `412` com código próprio;
- CORS responde corretamente;
- callback sempre redireciona por `303` para domínio permitido;
- webhook responde rápido e rejeita cabeçalhos inválidos.

### 19.4 E2E com conta real

1. login na aplicação;
2. conectar Google Calendar;
3. negar consentimento e verificar UX;
4. consentir e selecionar agenda;
5. criar, editar, cancelar e excluir no produto;
6. validar cada resultado no Google;
7. criar, editar e excluir no Google;
8. validar cada resultado no produto;
9. alterar simultaneamente e validar conflito;
10. executar sincronização duas vezes e confirmar idempotência;
11. revogar acesso na Conta Google;
12. validar erro controlado e reconexão;
13. testar com dois tenants e provar isolamento.

## 20. Deploy e release

Ordem segura:

1. revisar diff e preservar alterações não relacionadas;
2. aplicar migrations compatíveis com código antigo;
3. cadastrar secrets no ambiente;
4. publicar callback, start, status, list/select e workers da mesma versão;
5. conferir inventário e versões publicadas;
6. configurar URI exato no cliente OAuth;
7. testar endpoints sem sessão e com sessão;
8. executar E2E real;
9. ativar scheduler gradualmente;
10. registrar/renovar webhooks;
11. monitorar fila, erros e latência;
12. somente então declarar produção pronta.

Exemplo Supabase:

```powershell
npx supabase secrets set `
  APP_URL=https://app.exemplo.com `
  GOOGLE_CALENDAR_REDIRECT_URI=https://PROJECT_REF.supabase.co/functions/v1/calendar-oauth-callback `
  --project-ref PROJECT_REF

npx supabase functions deploy calendar-oauth-start --project-ref PROJECT_REF
npx supabase functions deploy calendar-oauth-callback --project-ref PROJECT_REF
npx supabase functions deploy calendar-connection-status --project-ref PROJECT_REF
```

Não coloque valores reais de client secret, service key ou encryption key em documentação, shell history compartilhado, ticket ou Git.

## 21. Rollback e recuperação

- migrations devem ser aditivas e compatíveis quando possível;
- não apague conexões, tokens, eventos ou outbox para “limpar” falhas;
- desative scheduler antes de rollback incompatível;
- preserve snapshots e auditoria;
- permita reprocessar dead-letter após corrigir a causa;
- ao trocar credenciais Google, publique secrets e Functions de forma coordenada;
- ao perder chave de criptografia sem backup, os refresh tokens não são recuperáveis: revogue e reconecte usuários;
- desconexão deve revogar quando possível, encerrar canais e marcar conexão, sem apagar compromissos locais.

## 22. Antipadrões proibidos

- OAuth completo no frontend;
- refresh token em localStorage;
- service role ou secret key no browser;
- confiar em `tenantId` enviado pelo cliente;
- usar apenas `profiles.tenant_id` quando existe membership ativa;
- misturar callbacks de login e Calendar sem contrato explícito;
- usar cliente OAuth de produção para localhost;
- publicar start/status e esquecer callback;
- processar lote inteiro dentro do clique do usuário;
- assumir que webhook contém os dados alterados;
- usar “última escrita vence” para eventos críticos sem visibilidade;
- apagar dados locais ao receber `410`;
- mostrar erro técnico bruto ao usuário;
- afirmar sucesso sem teste real Google → aplicação e aplicação → Google.

## 23. Checklist reutilizável

### Google Cloud

- [ ] Projetos/clients separados por ambiente
- [ ] Calendar API ativada
- [ ] Branding consistente
- [ ] Homepage pública informativa
- [ ] Nome visível na homepage coincide com o App Name do Google
- [ ] Política e termos públicos
- [ ] Domínios controlados/verificados
- [ ] Origem JavaScript exata
- [ ] Callback exato com `https://`
- [ ] Scopes mínimos
- [ ] Contatos monitorados
- [ ] Submissão/verificação concluída quando exigida
- [ ] Branding publicado após a última alteração

### Backend e banco

- [ ] OAuth start autenticado
- [ ] State persistido, expirável e de uso único
- [ ] Callback público com validação forte
- [ ] Refresh token cifrado
- [ ] Tenant por membership ativa
- [ ] RLS e tabelas internas fechadas
- [ ] Outbox idempotente
- [ ] Retry, jitter e dead-letter
- [ ] Sync incremental e tratamento de `410`
- [ ] Conflitos por etag/versão
- [ ] Webhook validado e renovável
- [ ] Scheduler monitorado

### Produto e operação

- [ ] Mensagens orientadas ao usuário
- [ ] Status e última sincronização visíveis
- [ ] Reconexão e desconexão funcionam
- [ ] E2E bidirecional real
- [ ] Isolamento entre tenants demonstrado
- [ ] Logs sem segredos
- [ ] Alertas de fila/canal/token
- [ ] Runbook de suporte e rollback

## 24. Referências oficiais

Google:

- [OAuth 2.0 para aplicações web server-side](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Políticas OAuth 2.0](https://developers.google.com/identity/protocols/oauth2/policies)
- [Escopos da Google Calendar API](https://developers.google.com/workspace/calendar/api/auth)
- [Sincronização incremental e sync tokens](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Push notifications e canais](https://developers.google.com/workspace/calendar/api/guides/push)
- [Tratamento de erros da Calendar API](https://developers.google.com/workspace/calendar/api/guides/errors)
- [Requisitos de verificação OAuth](https://support.google.com/cloud/answer/13464321?hl=pt-BR)
- [Enviar aplicativo para verificação](https://support.google.com/cloud/answer/13461325?hl=pt-BR)
- [Gerenciar o branding do aplicativo OAuth](https://support.google.com/cloud/answer/15549049?hl=pt-BR)
- [Requisitos da homepage do aplicativo](https://support.google.com/cloud/answer/13807376?hl=pt-BR)
- [Política de privacidade do aplicativo](https://support.google.com/cloud/answer/13806988?hl=pt-BR)

Supabase:

- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Segurança e autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Authorization e apikey headers](https://supabase.com/docs/guides/functions/auth-headers)
- [Configuração por Function](https://supabase.com/docs/guides/functions/function-configuration)
- [API keys e limites de exposição](https://supabase.com/docs/guides/getting-started/api-keys)

## 25. Critério de conclusão

Uma integração está pronta somente quando todas estas afirmações forem verdadeiras:

- o usuário entende o que será acessado e concede consentimento explícito;
- o callback correto conclui OAuth sem expor segredos;
- o refresh token é armazenado cifrado e pode ser rotacionado;
- o tenant é validado no servidor;
- evento criado em cada lado aparece no outro sem duplicidade;
- alterações, cancelamentos e exclusões têm comportamento previsível;
- conflitos são detectados e auditáveis;
- revogação e reconexão funcionam;
- scheduler, webhook, retry e dead-letter são observáveis;
- a política pública corresponde exatamente ao uso de dados;
- a verificação Google aplicável foi concluída;
- existe evidência E2E real, e não somente evidência de código ou deploy.
