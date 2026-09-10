# Plano completo — CRUD e sincronização bidirecional com Google Calendar

## 1. Objetivo

Entregar uma experiência em que o escritório possa:

- criar, consultar, editar, cancelar e excluir compromissos no CRM;
- vincular cada compromisso a um lead, responsável e agenda Google;
- enviar alterações do CRM para o Google Calendar;
- importar alterações feitas no Google Calendar;
- executar uma sincronização manual pelo botão **Sincronizar agora**;
- acompanhar sucesso, falhas, conflitos e última sincronização.

O escopo é de eventos/calendário. O Google Calendar não será tratado como cadastro de contatos. Leads continuam pertencendo ao CRM. Participantes de eventos podem ser usados apenas como informação ou sugestão de vínculo, nunca para criar leads automaticamente sem regra e consentimento.

## 2. Estado atual verificado

Já existe no projeto:

- autenticação OAuth Google;
- armazenamento cifrado do refresh token;
- escolha da agenda Google;
- tabela `calendar_events`;
- tabela `calendar_connections`;
- tabela `calendar_sync_outbox`;
- fila com deduplicação e retry;
- `calendar-sync-worker` para CRM → Google;
- campos `external_calendar_id` e `external_event_id`;
- status `pending`, `processing`, `synced`, `failed` e `cancelled`;
- CRUD básico de eventos no CRM.

Ainda falta:

- importação Google → CRM;
- exclusão propagada nos dois sentidos;
- tratamento formal de conflitos;
- botão de sincronização manual;
- scheduler do worker;
- sincronização incremental com `syncToken`;
- testes reais contra uma conta Google;
- observabilidade e operação de falhas.

## 3. Decisões de produto

### 3.1 Fonte e propriedade do evento

Cada evento terá uma origem:

- `crm`: criado ou controlado pelo CRM;
- `google`: criado diretamente no Google Calendar;
- `linked`: evento importado e posteriormente vinculado a um lead.

O CRM será a fonte principal para eventos criados dentro dele. Eventos criados no Google serão importados como eventos externos, sem criação automática de lead.

### 3.2 Exclusão e cancelamento

- **Cancelar** altera o status do compromisso e preserva histórico.
- **Excluir no CRM** deve solicitar confirmação e remover o evento remoto quando o CRM for a origem.
- Exclusão de evento criado no Google deve marcar o evento local como `cancelled` ou `deleted_external`, preservando auditoria.
- Nunca apagar silenciosamente um evento local apenas porque ele desapareceu em uma consulta parcial do Google.

### 3.3 Conflitos

Se o mesmo evento for alterado nos dois lados desde a última sincronização:

- não sobrescrever automaticamente;
- marcar `conflict`;
- preservar os dois snapshots;
- mostrar as opções **Manter CRM**, **Manter Google** e **Revisar manualmente**.

Para evitar risco operacional em prazos e audiências, conflitos não serão resolvidos por “última alteração vence” sem visibilidade ao usuário.

## 4. Arquitetura alvo

```text
CRUD no CRM ──┐
              ├─ calendar_events ── calendar_sync_outbox ── worker ── Google Calendar API
Google Calendar ── webhook/polling ── syncToken ── reconciliation ── calendar_events
              └─ auditoria, status, conflitos e alertas
```

Princípios:

- frontend usa somente publishable key e JWT do usuário;
- refresh token e service role ficam exclusivamente nas Edge Functions;
- toda mutação passa por RLS, RPC ou Edge Function apropriada;
- operações externas são idempotentes;
- fila é a fronteira entre gravação transacional e integração externa;
- falha do Google não pode desfazer o compromisso salvo no CRM.

## 5. Modelo de dados

### 5.1 Extensões em `calendar_events`

Adicionar, se ainda não existirem:

- `origin`: `crm | google | linked`;
- `sync_status`: incluir `conflict` e `deleted_external`;
- `google_etag`;
- `google_updated_at`;
- `last_local_change_at`;
- `last_remote_change_at`;
- `deleted_at`;
- `sync_version` ou equivalente para controle de concorrência;
- `attendees` em JSONB, sem transformar participantes em leads automaticamente.

### 5.2 Extensões em `calendar_connections`

- `calendar_sync_token`;
- `calendar_sync_token_updated_at`;
- `last_remote_sync_at`;
- `last_error`;
- `sync_enabled`;
- `timezone`;
- `connection_version` para invalidar estado após reconexão.

### 5.3 Nova tabela `calendar_event_snapshots`

Guardar versões locais/remotas para resolver conflitos:

- `id`;
- `calendar_event_id`;
- `source`: `crm | google`;
- `payload` JSONB normalizado;
- `etag`;
- `captured_at`;
- `created_by` quando aplicável.

### 5.4 Nova tabela `calendar_sync_runs`

Registrar cada execução manual ou automática:

- `id`;
- `office_id`;
- `requested_by`;
- `mode`: `manual | scheduled | webhook`;
- `status`: `running | completed | partial | failed`;
- `started_at`;
- `finished_at`;
- contadores de enviados, recebidos, atualizados, excluídos, conflitos e falhas;
- `error_summary`.

### 5.5 Fila

Manter `calendar_sync_outbox` e evoluir para:

- operação `upsert`, `delete`, `reconcile`;
- chave idempotente por evento, agenda e versão;
- `attempts`, `available_at`, `locked_at` e `last_error`;
- dead-letter lógico após tentativas esgotadas;
- reprocessamento manual de falhas.

## 6. APIs e Edge Functions

### 6.1 Funções existentes a preservar

- `calendar-oauth-start`;
- `calendar-oauth-callback`;
- `calendar-connection-status`;
- `calendar-list`;
- `calendar-select`;
- `calendar-sync-worker`.

### 6.2 Novas funções

#### `calendar-sync-now`

JWT obrigatório. Valida o usuário e o escritório, cria uma execução `manual`, enfileira pendências e dispara/processa um lote limitado. Retorna `syncRunId` e status inicial; não deve manter uma requisição longa para processar toda a agenda.

#### `calendar-reconcile`

Worker autenticado por secret de serviço. Usa `syncToken`, consulta alterações remotas, aplica idempotência e atualiza eventos locais. Deve tratar `410 Gone` invalidando o token e executando uma sincronização incremental completa da agenda.

#### `calendar-webhook`

Endpoint sem JWT para notificações do Google, validado por canal, recurso, token e conexão conhecida. A notificação apenas agenda reconciliação; não executa processamento pesado diretamente.

#### `calendar-conflict-resolve`

JWT obrigatório. Aceita `crm`, `google` ou `manual`, registra decisão e gera nova pendência de sincronização.

#### `calendar-event-delete`

JWT obrigatório. Aplica exclusão lógica local e enfileira `delete` remoto quando permitido pela origem e pela política do escritório.

## 7. Fluxo de sincronização CRM → Google

1. Usuário cria ou edita evento no CRM.
2. Transação salva `calendar_events`.
3. Trigger cria ou reabre item em `calendar_sync_outbox`.
4. Worker reserva a pendência com `FOR UPDATE SKIP LOCKED`.
5. Worker renova o access token usando o refresh token cifrado.
6. Worker executa `PATCH` pelo `external_event_id`.
7. Se o evento não existir, executa `INSERT` idempotente.
8. Atualiza IDs externos, `etag`, status e timestamps.
9. Registra resultado em `calendar_sync_runs` e auditoria.

## 8. Fluxo de sincronização Google → CRM

1. Webhook ou botão manual solicita reconciliação.
2. Worker usa o `syncToken` salvo na conexão.
3. Busca somente alterações desde a última sincronização.
4. Para cada evento:
   - localiza por `external_event_id`;
   - normaliza timezone, título, descrição, início, fim, local e participantes;
   - cria evento externo se não existir;
   - atualiza evento vinculado se não houver conflito;
   - registra exclusão remota como estado local preservado.
5. Salva novo `syncToken` somente após concluir o lote com segurança.
6. Em caso de `410 Gone`, limpa o token e executa reconciliação completa controlada.

## 9. Interface do CRM

### 9.1 CRUD de agenda

Na tela de Agenda e no detalhe do lead:

- botão **Novo compromisso**;
- editar título, tipo, status, início, fim, local, observações e responsável;
- vincular/desvincular lead;
- cancelar e excluir com confirmação;
- mostrar origem do evento;
- mostrar agenda Google associada;
- mostrar status de sincronização.

### 9.2 Botão **Sincronizar agora**

Exibir:

- última sincronização;
- botão manual;
- estado `Sincronizando...`;
- contadores do último `syncRun`;
- falhas com opção **Tentar novamente**;
- conflitos com opção **Resolver**;
- aviso quando a conexão estiver revogada ou sem agenda selecionada.

O botão deve possuir debounce/idempotência para impedir múltiplas execuções concorrentes do mesmo escritório.

### 9.3 Eventos externos

Eventos criados no Google devem aparecer com indicação visual **Criado no Google**. O usuário poderá vinculá-los a um lead posteriormente, mas o sistema não deve inferir automaticamente um cliente apenas pelo nome ou e-mail do participante.

## 10. Segurança e privacidade

- solicitar somente escopos Google necessários;
- manter refresh token cifrado com AES-256-GCM;
- nunca enviar refresh token ao frontend;
- validar tenant pelo usuário autenticado;
- restringir operações de conexão e seleção a papéis permitidos;
- usar `state` OAuth de uso único e expiração curta;
- validar webhook e impedir replay;
- redigir tokens, códigos OAuth e dados sensíveis dos logs;
- aplicar rate limit no botão manual e nos endpoints públicos;
- registrar auditoria de conexão, desconexão, exclusão e resolução de conflitos.

## 11. Testes

### Unitários

- normalização de eventos e timezone;
- geração de external ID idempotente;
- conversão de status;
- detecção de conflito por `etag`/versão;
- tratamento de `410 Gone`;
- retry e backoff.

### Integração Supabase

- trigger cria uma única pendência;
- alterações reabrem a pendência;
- `SKIP LOCKED` impede processamento duplicado;
- RLS impede acesso à fila e tokens;
- isolamento entre escritórios;
- exclusão lógica preserva auditoria.

### Integração Google

Com uma conta de teste autorizada:

- criar no CRM e confirmar no Google;
- editar no CRM e confirmar atualização;
- criar no Google e confirmar importação;
- editar no Google e confirmar atualização no CRM;
- excluir nos dois sentidos;
- revogar autorização;
- expirar token;
- provocar conflito;
- repetir a mesma sincronização e confirmar ausência de duplicidade.

### Testes de interface

- estados loading/sucesso/falha;
- reconexão;
- agenda sem eventos;
- muitos eventos;
- conflito pendente;
- mobile;
- acessibilidade do botão e mensagens.

## 12. Operação local sem custo de plataforma

Durante o desenvolvimento:

- Supabase local via Docker;
- Edge Functions servidas localmente;
- scheduler substituído por execução manual ou tarefa local;
- Google Cloud usado apenas para OAuth/API;
- nenhum serviço pago adicional necessário.

Para produção, o worker deverá ser executado por scheduler confiável. O scheduler deve usar secret de serviço e timeout menor que o intervalo entre execuções. A ausência do scheduler significa que a fila pode acumular mesmo que o CRUD continue funcionando.

## 13. Ordem de implementação

### Fase 1 — Contrato e modelo

- migration de estados, snapshots, sync runs e tokens;
- revisar índices e RLS;
- ampliar tipos TypeScript;
- definir payload canônico do evento.

### Fase 2 — CRUD e exclusão

- completar CRUD de eventos;
- implementar cancelamento e exclusão lógica;
- criar operação de delete remoto;
- atualizar tela de Agenda e detalhe do lead.

### Fase 3 — Sincronização manual

- criar `calendar-sync-now`;
- criar `calendar_sync_runs`;
- adicionar botão e painel de resultado;
- implementar retry manual.

### Fase 4 — Google → CRM

- implementar `syncToken`;
- implementar reconciliação incremental;
- tratar eventos externos;
- tratar `410 Gone` e exclusões.

### Fase 5 — Conflitos

- snapshots locais/remotos;
- estado `conflict`;
- tela de resolução;
- auditoria da decisão.

### Fase 6 — Automação

- webhook Google ou polling controlado;
- scheduler;
- alertas de falha;
- métricas operacionais.

### Fase 7 — Homologação e produção

- testar conta Google real;
- configurar secrets Cloud;
- publicar migrations e Functions;
- configurar OAuth redirect de produção;
- validar scheduler;
- executar checklist de rollback e suporte.

## 14. Critérios de aceite

O recurso será considerado pronto quando:

- evento criado no CRM aparecer no Google sem duplicidade;
- edição e cancelamento forem propagados corretamente;
- evento criado no Google aparecer no CRM;
- eventos externos puderem ser vinculados manualmente a leads;
- exclusões forem auditáveis e previsíveis;
- conflitos nunca forem sobrescritos silenciosamente;
- botão manual mostrar resultado rastreável;
- retry funcionar após falha transitória;
- tokens nunca aparecerem no frontend ou logs;
- RLS impedir acesso cruzado entre escritórios;
- scheduler executar o worker de forma idempotente;
- testes locais e teste real com conta Google passarem;
- rollback e desconexão da conta estiverem documentados.

## 15. Riscos e controles

| Risco | Controle |
|---|---|
| Duplicação de eventos | `external_event_id`, idempotência e unique index |
| Perda de alterações | snapshots, `syncToken` e fila durável |
| Conflito CRM/Google | estado explícito e decisão manual |
| Token inválido | renovação, status `error` e reconexão |
| Exclusão indevida | exclusão lógica, confirmação e auditoria |
| Fila sem processamento | scheduler, métricas e alerta |
| Vazamento de credenciais | secrets somente no backend |
| Criação indevida de leads | não importar contatos automaticamente |
| Concorrência | locks, versões e processamento idempotente |

## 16. Resultado esperado

O cliente terá um CRM completo para operar sua agenda, sem perder a praticidade de usar o Google Calendar. O CRM será responsável pelo contexto jurídico-operacional — lead, responsável, histórico e permissões — enquanto o Google Calendar funcionará como agenda externa sincronizada, com transparência sobre origem, estado, falha e conflito.
