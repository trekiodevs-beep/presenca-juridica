# Plano de implementação — Central de Atenção e Alarmes Operacionais

**Projeto:** CRM Presença Jurídica

**Data-base:** 10/09/2026

**Status:** plano técnico; nenhuma etapa deste documento representa implementação, migration aplicada, deploy ou prova de produção

**Referência de origem:** relatório técnico da Central de Alarmes do VendasFast/FilaZero

## 1. Objetivo

Transformar o sino estático da barra superior em uma Central de Atenção persistente, multiusuário e multi-tenant, capaz de:

- detectar condições operacionais no backend, sem depender de uma tela aberta;
- mostrar ao usuário somente os alarmes dos quais ele é destinatário;
- separar condição operacional, leitura pessoal e entrega externa;
- manter histórico de reconhecimento e resolução;
- resolver automaticamente alarmes quando a fonte deixa de estar pendente;
- atualizar o frontend por Supabase Realtime, com recuperação por polling;
- alimentar o sino, a página completa da Central e os pontos de atenção do dashboard a partir da mesma fonte;
- preservar revisão humana em ações jurídicas, financeiras, administrativas e de privacidade.

O nome de produto recomendado é **Central de Atenção**. No domínio técnico, usar **alarme operacional** para a condição persistida e **notificação** somente para sua entrega ao usuário.

## 2. Resultado esperado

Ao final da implementação:

1. o sino não exibirá mais um ponto vermelho fixo;
2. o badge exibirá a quantidade real de alarmes ativos e não adiados para o usuário;
3. clicar no sino abrirá uma lista resumida com até oito itens;
4. cada item levará à tela canônica da origem;
5. haverá uma página `/alertas` com filtros, histórico e paginação;
6. leitura, snooze e dispensa serão pessoais;
7. reconhecimento e resolução serão ações operacionais compartilhadas e auditadas;
8. alarmes temporais serão gerados mesmo com o frontend fechado;
9. dois escritórios não conseguirão ler nem alterar alarmes entre si;
10. o dashboard e a Central não apresentarão contagens contraditórias.

## 3. Escopo e limites

### 3.1 Incluído no primeiro ciclo

- núcleo persistente de alarmes;
- destinatários e leitura individual;
- histórico imutável de transições;
- RPCs seguras;
- RLS;
- motor determinístico server-side;
- Realtime e polling de recuperação;
- sino, popover e página completa;
- alarmes de contatos, próximas ações, tarefas, agenda, financeiro e sincronização da agenda;
- integração progressiva com `Hoje` e `Dashboard`;
- modo demonstrativo compatível com `VITE_USE_MOCK_DATA=true`;
- testes de domínio, banco, RLS, idempotência e concorrência.

### 3.2 Fora do primeiro ciclo

- captura automática de prazos em tribunais ou Diário de Justiça;
- cálculo jurídico de dias úteis, suspensões forenses ou feriados locais;
- afirmação de que o CRM substitui controle processual oficial;
- envio por WhatsApp, SMS, push ou e-mail;
- IA para classificar ou priorizar alarmes;
- automações que alterem lead, tarefa, compromisso ou lançamento financeiro sem confirmação humana;
- configuração completa de todas as regras por escritório;
- publicação remota, deploy ou Git sem autorização específica.

## 4. Estado atual verificado que deve ser preservado

- `src/components/layout/Topbar.tsx`: sino é apenas visual; o ponto vermelho é estático.
- `src/App.tsx`: não existe rota `/alertas`.
- `src/pages/Hoje.tsx`: calcula triagem, providências, tarefas, agenda e financeiro no frontend.
- `src/lib/dashboardMetrics.ts`: possui `getAttentionItems`, com providência vencida, contato sem responsável, ausência de interação em 24 horas, triagem em 24 horas, espera de informações em três dias e proposta em sete dias.
- `src/context/DataContext.tsx`: mantém coleções operacionais do escritório; alarmes não devem ser adicionados a esse contexto porque exigem paginação, destinatário e ciclo próprios.
- `src/services/supabaseDb.ts`: já usa `postgres_changes`, mas recarrega a tabela inteira a cada evento. A Central deve usar um serviço dedicado e consulta limitada.
- `src/types.ts`: `Lead` possui `responsibleUserId` e `nextActionAt`; `CalendarEvent` possui responsável, mas não expõe atualmente os campos de sincronização.
- `supabase/migrations/20260909000100_initial_core.sql`: contém `office_id`, memberships, leads, tarefas, agenda, outbox e auditoria.
- `supabase/migrations/20260909000600_financial_records.sql`: financeiro possui `due_at` e status, mas vencimento temporal não é materializado automaticamente.
- `supabase/migrations/20260909000800_audit_rpc.sql`: existe infraestrutura de auditoria autenticada.
- `supabase/migrations/20260909001400_calendar_sync_contract.sql`: existe padrão idempotente com índice parcial e claim por `FOR UPDATE SKIP LOCKED`.
- `tests-supabase/rls.test.ts`: já existe padrão de teste com dois escritórios e clientes autenticados.
- `tests-supabase/calendar.test.ts`: já existe padrão de teste de idempotência e reabertura.
- `functions/src/index.ts`: contém implementação Firebase legada. Não usar esse caminho para a nova Central.

O executor deve começar com `git status --short --branch` e preservar todas as alterações preexistentes. Não limpar, reverter, formatar em massa, mover ou publicar arquivos fora deste plano.

## 5. Decisões arquiteturais obrigatórias

### 5.1 Separação dos quatro conceitos

1. **Alarme:** condição operacional compartilhada e persistente.
2. **Evento do alarme:** transição imutável para rastreabilidade.
3. **Destinatário:** estado pessoal de leitura, snooze e dispensa.
4. **Entrega externa:** outbox futuro para e-mail/WhatsApp; não faz parte do MVP.

Não colocar `read_at`, `dismissed_at` ou `snoozed_until` na linha compartilhada do alarme.

### 5.2 Backend como autoridade

- Usar `timezone('utc', now())` no PostgreSQL.
- Não gerar alarme de produção em React.
- Não confiar em `office_id`, ator ou destinatário enviados pelo navegador.
- O frontend não pode executar `INSERT`, `UPDATE` ou `DELETE` diretamente nas tabelas de alarmes.
- Toda mutação deve ocorrer por RPC autenticada ou função interna de `service_role`.

### 5.3 Leitura não resolve pendência

- `read_at`: usuário viu a mensagem.
- `ACKNOWLEDGED`: alguém assumiu a pendência.
- `RESOLVED`: a condição deixou de existir ou houve resolução comprovada.
- Ler o alerta nunca deve atualizar a entidade de origem nem resolver o alarme.

### 5.4 Compatibilidade e simplicidade

- Usar `text` com `check`, seguindo o padrão atual das migrations, em vez de introduzir enums PostgreSQL nesta etapa.
- Adições de coluna devem ser compatíveis com registros existentes.
- Não mover alarmes para `DataContext`.
- Não adicionar biblioteca de estado global.
- Não adicionar biblioteca de notificações, filas ou componentes se React, Supabase e os componentes atuais forem suficientes.

## 6. Modelo de dados alvo

Criar migrations novas, sem alterar migrations já versionadas.

Sequência de arquivos recomendada:

1. `supabase/migrations/20260910000100_alarm_prerequisites.sql`: responsável/criador de tarefa, eventos estruturados de lead e campos necessários de integração;
2. `supabase/migrations/20260910000200_operational_alarm_core.sql`: tabelas, constraints, índices, triggers de timestamp e RLS;
3. `supabase/migrations/20260910000300_operational_alarm_lifecycle.sql`: funções internas e RPCs transacionais;
4. `supabase/migrations/20260910000400_operational_alarm_rules.sql`: avaliador, resolução automática, recipients e observabilidade;
5. `supabase/migrations/20260910000500_operational_alarm_realtime.sql`: publicação Realtime idempotente, somente depois dos testes de RLS.

Se algum nome já existir quando a execução começar, o executor deve preservar a ordem cronológica e escolher o próximo sufixo livre, sem sobrescrever migration.

### 6.1 `operational_alarms`

Campos mínimos:

| Campo | Regra |
|---|---|
| `id` | UUID, chave primária |
| `office_id` | obrigatório, FK para `offices`, `ON DELETE CASCADE` |
| `source_type` | `LEAD`, `TASK`, `CALENDAR_EVENT`, `FINANCIAL_RECORD`, `CALENDAR_INTEGRATION`, `OFFICE`, `SUPPORT_REQUEST` |
| `source_id` | UUID opcional; obrigatório para fontes que representam uma linha |
| `rule_code` | código estável da regra |
| `cycle_key` | identidade determinística da ocorrência |
| `severity` | `INFO`, `WARNING`, `CRITICAL` |
| `state` | `OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `CANCELED` |
| `assigned_user_id` | responsável operacional opcional |
| `title` | texto curto e sem informação sensível excessiva |
| `message` | explicação operacional curta |
| `action_path` | rota interna começando por `/` |
| `base_at` | instante de referência opcional |
| `due_at` | vencimento opcional |
| `triggered_at` | instante real de abertura |
| `acknowledged_at/by` | primeira assunção da pendência |
| `resolved_at/by` | encerramento |
| `resolution_code` | motivo estruturado |
| `resolved_automatically` | diferencia motor e ação humana |
| `metadata` | snapshot mínimo e sem documentos, CPF, telefone ou conteúdo do caso |
| `rule_version` | versão da regra |
| `version` | controle otimista de concorrência |
| `last_evaluated_at` | observabilidade |
| `created_at/updated_at` | rastreabilidade |

Índice único parcial:

```text
(office_id, source_type, source_id, rule_code, cycle_key)
WHERE state IN ('OPEN', 'ACKNOWLEDGED')
```

Índices adicionais:

- `(office_id, state, severity, due_at)`;
- `(assigned_user_id, state, due_at)`;
- `(source_type, source_id)`;
- `(office_id, triggered_at desc)`.

### 6.2 `operational_alarm_events`

Append-only, com:

- `alarm_id`;
- `office_id`;
- `event_type`;
- `from_state`;
- `to_state`;
- `actor_user_id` opcional para eventos do motor;
- `reason` limitado;
- `metadata` mínimo;
- `created_at`.

Não permitir update/delete por usuários autenticados. Essa tabela registra o domínio do alarme e não substitui `audit_logs`.

### 6.3 `operational_alarm_recipients`

Campos:

- `alarm_id`;
- `office_id`;
- `user_id`;
- `delivery_reason`: `ASSIGNEE`, `OWNER`, `ADMIN`, `FINANCE`, `FALLBACK`;
- `read_at`;
- `snoozed_until`;
- `dismissed_at`;
- `created_at`;
- `updated_at`.

Chave única `(alarm_id, user_id)`. O motor materializa destinatários concretos usando memberships ativas. Reavaliar destinatários enquanto o alarme estiver aberto para cobrir troca de responsável ou administrador.

### 6.4 Complemento de tarefas

Adicionar a `tasks`, de modo compatível:

- `responsible_user_id uuid null references profiles(id) on delete set null`;
- `created_by uuid null references profiles(id) on delete set null`.

Registros antigos podem permanecer sem responsável. O formulário deve selecionar por padrão o usuário atual, permitindo alteração somente para membros ativos visíveis ao papel atual.

### 6.5 Eventos de lead estruturados

Adicionar campos opcionais a `lead_events`:

- `from_status text`;
- `to_status text`;
- `metadata jsonb not null default '{}'::jsonb`.

Parar de inferir transição de status a partir de `description.includes(...)`. Preservar `description` por compatibilidade e exibição histórica.

## 7. Permissões e destinatários

| Regra | Destinatários primários | Fallback |
|---|---|---|
| contato novo/sem responsável/triagem | responsável, quando existir | `owner` e `admin` |
| próxima ação | responsável do lead | `owner` e `admin` |
| tarefa | responsável da tarefa | criador, depois `owner`/`admin` |
| agenda | responsável do compromisso | `owner`/`admin` |
| financeiro | `owner`, `admin`, `finance` | nenhum outro papel |
| falha de calendário | dono da conexão, `owner`, `admin` | nenhum |
| assinatura/limite | `owner`, `admin` | nenhum |
| suporte/LGPD | somente `owner` ou solicitante, conforme a regra | nenhum |

Regras obrigatórias:

- membership deve estar `active` no momento da materialização;
- usuário `read` não recebe alerta que exija mutação;
- `assistant` não recebe valores financeiros;
- conteúdo de um alarme financeiro não pode vazar a um papel sem permissão;
- mudança de responsável atualiza destinatários sem apagar histórico anterior;
- destinatário removido perde leitura por RLS imediatamente.

## 8. Catálogo inicial de regras

### 8.1 Primeira liberação

| Código | Disparo | Severidade | Encerramento automático | `cycle_key` |
|---|---|---|---|---|
| `LEAD_UNASSIGNED` | lead ativo sem responsável por 30 min | `WARNING` | responsável definido ou lead encerrado | `created_at` do lead |
| `TRIAGE_OVERDUE` | `Novo contato`/`Aguardando triagem` por mais de 24 h | `WARNING` | saída desses estados | entrada no estado |
| `NEXT_ACTION_OVERDUE` | `next_action_at < now()` em lead ativo | `WARNING` | data removida, reagendada ou lead encerrado | valor de `next_action_at` |
| `TASK_OVERDUE` | tarefa não concluída e `due_at < now()` | `WARNING` | concluída ou reagendada | valor de `due_at` |
| `APPOINTMENT_UPCOMING_24H` | compromisso agendado entra na janela de 24 h | `INFO` | cancelado, concluído ou passado | `start_at:24h` |
| `APPOINTMENT_UPCOMING_1H` | compromisso agendado entra na janela de 1 h | `WARNING` | cancelado, concluído ou passado | `start_at:1h` |
| `FINANCIAL_OVERDUE` | vencimento passado e status diferente de pago/cancelado | `WARNING` | pago, cancelado ou renegociado | valor de `due_at` |
| `CALENDAR_SYNC_FAILED` | `sync_status='failed'` ou outbox em falha terminal | `CRITICAL` | sincronização recuperada ou conexão desativada conscientemente | tentativa terminal/versão do evento |

Os limites de 30 minutos e 24 horas são defaults iniciais versionados. Não construir uma tela completa de configuração na primeira liberação.

### 8.2 Regras posteriores, somente após dados confiáveis

- `FIRST_INTERACTION_OVERDUE`: somente depois de existir evento explícito de interação enviada/registrada. Clique no WhatsApp não prova resposta.
- `WAITING_INFORMATION_STALE`: usar `to_status`, não texto da descrição.
- `PROPOSAL_FOLLOWUP_OVERDUE`: usar transição estruturada e evento real de acompanhamento.
- `PORTAL_ITEM_PENDING`: somente depois que o listener real do portal substituir o stub atual.
- `DOCUMENT_RECEIVED`: somente quando houver fluxo real de recebimento pelo cliente.
- `TRIAL_ENDING`, `SUBSCRIPTION_PAST_DUE`, `USAGE_LIMIT`: integrar depois do núcleo operacional.
- regras de prazo jurídico: somente na fase específica de homologação profissional.

### 8.3 Supressão e agrupamento

- Permitir múltiplas condições persistidas por entidade.
- Na interface, agrupar alarmes pelo mesmo `source_type/source_id`.
- Exibir a maior severidade como principal e as demais como razões secundárias.
- `NEXT_ACTION_OVERDUE` deve ter precedência visual sobre `PROPOSAL_FOLLOWUP_OVERDUE`.
- `TRIAGE_OVERDUE` pode absorver `LEAD_UNASSIGNED` na visualização, sem apagar o segundo registro.
- Nunca esconder um `CRITICAL` por causa de um `INFO` mais recente.

## 9. Máquina de estados

Transições permitidas:

```text
OPEN -> ACKNOWLEDGED
OPEN -> RESOLVED
OPEN -> CANCELED
ACKNOWLEDGED -> RESOLVED
ACKNOWLEDGED -> CANCELED
RESOLVED -> OPEN apenas pelo motor e somente em novo cycle_key
CANCELED -> OPEN apenas pelo motor e somente em novo cycle_key
```

Regras:

- uma ação humana atrasada não pode regredir `RESOLVED` para `ACKNOWLEDGED`;
- `acknowledged_at/by` preserva o primeiro reconhecimento;
- cada transição grava um evento e uma entrada resumida de auditoria na mesma transação;
- resolução automática usa `actor_user_id=null`, `resolved_automatically=true` e código estruturado;
- reabertura da mesma condição exige novo `cycle_key`; não ressuscitar histórico antigo.

## 10. RPCs

### 10.1 RPCs autenticadas

- `list_my_operational_alarms(p_states, p_severities, p_cursor, p_limit)`;
- `get_my_operational_alarm_counts()`;
- `mark_operational_alarm_read(p_alarm_id)`;
- `snooze_operational_alarm_for_me(p_alarm_id, p_until)`;
- `dismiss_operational_alarm_for_me(p_alarm_id)` somente para tipos dispensáveis;
- `acknowledge_operational_alarm(p_alarm_id, p_expected_version)`;
- `resolve_operational_alarm(p_alarm_id, p_resolution_code, p_reason, p_expected_version)`.

### 10.2 RPCs internas

- `evaluate_office_operational_alarms(p_office_id)`;
- `evaluate_operational_alarm_batch(p_batch_size)`;
- `refresh_operational_alarm_recipients(p_alarm_id)`;
- funções internas de abertura, atualização e encerramento.

### 10.3 Regras obrigatórias das RPCs

- `SECURITY DEFINER` somente quando necessário;
- `set search_path = public`;
- revogar execução de `public` e `anon`;
- funções internas executáveis somente por `service_role`;
- validar papel dentro da função, não apenas no frontend;
- obter `office_id` e ator da sessão e das linhas persistidas;
- usar `UPDATE ... WHERE version = p_expected_version AND state IN (...) RETURNING`;
- incrementar `version` em toda transição compartilhada;
- retornar conflito distinguível quando outra ação vencer a corrida;
- limitar tamanho de motivo e validar `p_until`;
- impedir snooze indefinido; limite inicial recomendado de sete dias;
- impedir dispensa pessoal de alarmes críticos.

## 11. RLS

### 11.1 `operational_alarms`

Permitir `SELECT` somente quando:

- existe recipient para `auth.uid()`;
- membership do usuário no mesmo `office_id` está ativa.

Negar `INSERT`, `UPDATE` e `DELETE` diretos para `authenticated`.

### 11.2 `operational_alarm_recipients`

- usuário lê somente sua própria linha e somente enquanto possui membership ativa;
- nenhuma escrita direta pelo frontend;
- administradores não alteram estado pessoal de outro usuário.

### 11.3 `operational_alarm_events`

- leitura permitida somente se o usuário pode ler o alarme correspondente;
- sem escrita direta;
- histórico nunca deve ser apagado por ação normal do usuário.

## 12. Motor de avaliação

### 12.1 Estratégia

Usar dois mecanismos complementares:

1. triggers ou chamadas transacionais para encerrar imediatamente alarmes quando a origem muda para condição saudável;
2. avaliador temporal set-based para abrir condições dependentes da passagem do tempo.

Não implementar loops com uma consulta ou insert por entidade no frontend.

### 12.2 Agendamento

- implementar a avaliação como função SQL restrita a `service_role`;
- preparar uma Edge Function `alarm-evaluator` somente como ponto operacional de execução e observabilidade;
- executar em lotes, registrando início, duração, avaliados, abertos, resolvidos e erros;
- frequência inicial recomendada: cinco minutos;
- configurar scheduler remoto somente na etapa de implantação;
- se o ambiente remoto não oferecer o mecanismo previsto, parar e documentar o bloqueio; não substituir por polling do navegador.

### 12.3 Concorrência e idempotência

- reutilizar o padrão conceitual de `FOR UPDATE SKIP LOCKED` já existente no calendário;
- usar índice único parcial como última barreira contra duplicação;
- conflito de unicidade esperado deve virar resultado idempotente, não erro genérico;
- executar abertura/encerramento, histórico e destinatários na mesma transação;
- uma falha ao entregar Realtime não pode desfazer a criação do alarme.

### 12.4 Observabilidade

Registrar, sem PII desnecessária:

- `run_id`;
- início, fim e duração;
- escritórios avaliados;
- alarmes abertos, atualizados, resolvidos e ignorados por idempotência;
- falhas por `rule_code`;
- atraso máximo entre `due_at` e `triggered_at`;
- última execução bem-sucedida.

## 13. Contrato de frontend

### 13.1 Novos arquivos recomendados

- `src/services/supabaseAlarms.ts`: mapper, RPCs, paginação e Realtime.
- `src/lib/alarmDomain.ts`: ordenação, agrupamento, severidade, deep link e view models puros.
- `src/hooks/useOperationalAlarms.ts`: carga resumida, contadores, subscription e polling.
- `src/components/alarms/AlarmBell.tsx`: sino, badge e abertura do painel.
- `src/components/alarms/AlarmPopover.tsx`: lista de até oito itens e ações pessoais.
- `src/components/alarms/AlarmListItem.tsx`: apresentação reutilizável.
- `src/pages/Alarms.tsx`: página completa.
- `tests/alarms-domain.test.ts`: domínio sem dependência de DOM.
- `tests-supabase/alarms.test.ts`: banco, RPC e RLS.

Não fragmentar além desses componentes antes de existir duplicação real.

### 13.2 Alterações pontuais

- `src/types.ts`: adicionar tipos do domínio e campos novos de tarefa/evento/calendário.
- `src/components/layout/Topbar.tsx`: substituir botão estático por `AlarmBell`.
- `src/App.tsx`: adicionar rota autenticada `/alertas`.
- `src/pages/Tasks.tsx`: responsável pela tarefa.
- `src/services/supabaseDb.ts`: mapear os novos campos de tarefa, lead event e sincronização.
- `src/context/DataContext.tsx`: apenas transportar os novos campos operacionais; não carregar alarmes.
- `src/lib/dashboardMetrics.ts`: manter lógica existente durante modo sombra e depois migrar os pontos de atenção para a fonte persistida.
- `src/pages/Hoje.tsx`: preservar indicadores de rotina; trocar apenas a seção de pendências quando houver paridade.
- `src/pages/Dashboard.tsx`: passar a contar alarmes persistidos depois da validação.
- `src/lib/demoStore.ts` e `src/mockData.ts`: exemplos determinísticos para validar UI em mock.

### 13.3 Comportamento do sino

- badge = quantidade de alarmes ativos, atribuídos ao usuário, não dispensados e não adiados;
- cap visual `99+`;
- presença de crítico aberto altera a cor, sem depender de `read_at`;
- item não lido recebe marcador discreto;
- ler não remove o item do badge se a condição continuar ativa;
- painel com abas `Para mim`, `Equipe` e `Sistema`; na primeira entrega, `Para mim` é obrigatório e as demais podem ser filtros de destinatários já materializados;
- ações: abrir origem, marcar como lido, reconhecer, adiar e resolver quando permitido;
- botão `Ver toda a central` leva a `/alertas`;
- fechar ao clicar fora e pela tecla Escape;
- foco e atributos ARIA obrigatórios;
- em mobile, usar painel/drawer com largura total útil, sem depender de hover.

### 13.4 Página `/alertas`

- filtros por estado, severidade, origem e período;
- paginação por cursor, nunca limite fixo silencioso;
- agrupamento por origem;
- linha do tempo de transições;
- responsável e vencimento;
- ação primária para a origem;
- estados de loading, vazio, erro, conexão degradada e conflito de versão;
- nenhum botão deve concluir a entidade de origem automaticamente.

### 13.5 Realtime e recuperação

- assinar mudanças de alarmes e recipients aplicáveis ao usuário;
- aplicar debounce curto;
- atualizar contadores incrementalmente ou recarregar somente o resumo;
- polling somente quando a aba estiver visível, com backoff;
- exibir estado degradado se Realtime/poll falhar repetidamente;
- cancelar canais e timers no unmount ou mudança de escritório;
- não usar o padrão atual de recarregar toda a tabela operacional a cada mudança.

## 14. Modo demonstrativo

Com `VITE_USE_MOCK_DATA=true`:

- fornecer exemplos determinísticos de `INFO`, `WARNING` e `CRITICAL`;
- simular leitura, snooze, reconhecimento e resolução em storage local;
- manter esse comportamento isolado do serviço Supabase;
- não chamar derivação mock de prova de backend;
- não permitir que mock esconda erro de produção quando `VITE_USE_MOCK_DATA=false`.

## 15. Plano de execução detalhado

### Fase 0 — fotografia e contrato

1. Registrar branch, HEAD, status e diff inicial.
2. Confirmar que o caminho real usa Supabase em modo não mock.
3. Listar migrations aplicadas localmente antes de criar novas.
4. Criar tipos e catálogo de regras em documento/código sem UI.
5. Confirmar que não há tabela de alarmes Supabase preexistente.

**Gate:** nenhuma alteração funcional antes de o contrato de estados, destinatários e regras estar expresso em testes ou tipos.

### Fase 1 — schema e segurança

1. Criar migration do núcleo de alarmes.
2. Criar migration de responsável da tarefa e eventos estruturados.
3. Criar índices e triggers de `updated_at`.
4. Implementar RLS e revogações.
5. Implementar funções auxiliares internas.
6. Escrever testes de dois escritórios antes da UI.

**Gate:** escrita direta negada, leitura cruzada vazia e destinatário removido sem acesso.

### Fase 2 — ciclo de vida

1. Implementar RPCs pessoais de leitura/snooze/dispensa.
2. Implementar reconhecimento e resolução com `expected_version`.
3. Inserir evento e auditoria atomicamente.
4. Testar corrida reconhecer × resolver com `Promise.all`.
5. Testar que estado terminal não regride.

**Gate:** testes de concorrência, auditoria e primeira identidade passam em PostgreSQL real local.

### Fase 3 — regras determinísticas

1. Implementar `NEXT_ACTION_OVERDUE`.
2. Implementar `LEAD_UNASSIGNED`.
3. Implementar `TRIAGE_OVERDUE`.
4. Implementar `TASK_OVERDUE`.
5. Implementar resolução automática pelas fontes.
6. Materializar destinatários.
7. Executar N vezes e provar ausência de duplicação.

**Gate:** resultados iguais em execuções repetidas; mudança da origem encerra o alarme com a UI fechada.

### Fase 4 — agenda, financeiro e integração

1. Implementar janelas de 24 h e 1 h da agenda.
2. Tratar timezone de exibição explicitamente; persistir UTC.
3. Implementar financeiro vencido por `due_at` e estado não terminal.
4. Implementar falha terminal do Google Calendar.
5. Expor `syncStatus`, `syncError` e `lastSyncedAt` no tipo/mapeamento.

**Gate:** fronteiras temporais exatas, reagendamento e recuperação da integração cobertos por teste.

### Fase 5 — frontend isolado

1. Implementar tipos, mapper e serviço.
2. Implementar hook com paginação e contadores.
3. Implementar sino e popover.
4. Implementar página completa.
5. Implementar estados vazios, falha e conflito.
6. Implementar mock determinístico.

**Gate:** sino não exibe badge sem alarme, crítico permanece visível após leitura e deep link abre a origem correta.

### Fase 6 — modo sombra e paridade

1. Manter `getAttentionItems` como fonte visível temporária.
2. Rodar o motor e comparar por lead/regra.
3. Classificar divergências como correção, mudança deliberada ou dado insuficiente.
4. Corrigir falsos positivos e regras sobrepostas.
5. Registrar métricas do avaliador.

**Gate:** nenhuma troca do dashboard antes de haver correspondência explicada, não necessariamente igualdade cega.

### Fase 7 — integração com Hoje e Dashboard

1. Trocar apenas a lista de pontos de atenção pela fonte persistida.
2. Preservar indicadores de rotina que não são alarmes.
3. Fazer KPI de alarmes críticos e ativos consultar a mesma fonte da Central.
4. Não contar `RESOLVED`, `CANCELED` ou recipients em snooze no badge pessoal.
5. Definir explicitamente se KPI gerencial inclui snooze pessoal; recomendado: incluir, pois a condição operacional permanece aberta.

**Gate:** Central, sino e KPI usam a mesma definição de estado operacional.

### Fase 8 — worker e prova com UI fechada

1. Implementar entrada operacional do worker.
2. Rodar manualmente localmente.
3. Criar fonte com vencimento futuro curto.
4. Fechar a aplicação.
5. Executar o worker após o vencimento.
6. Reabrir e confirmar o alarme persistido.
7. Corrigir a origem e confirmar resolução automática sem abrir a Central.

**Gate:** passagem do tempo funciona sem React aberto.

### Fase 9 — validação local completa

Adicionar ao `package.json` um script explícito:

```json
"test:alarms": "tsx --test tests-supabase/alarms.test.ts"
```

Não incluir o teste de integração Supabase no `validate` padrão enquanto ele depender de chaves e runtime local. A ausência dessas variáveis deve produzir instrução clara, não falso sucesso.

Executar, nesta ordem:

```text
npm run lint
npm test
npm run build
npm run test:rls
npm run test:calendar
npm run test:alarms
git diff --check
```

Não reportar os comandos como aprovados sem executá-los na rodada atual. Falha preexistente deve ser separada de regressão introduzida.

### Fase 10 — implantação controlada

Somente com autorização:

1. revisar diff e migrations;
2. verificar projeto Supabase alvo;
3. aplicar migration em homologação;
4. habilitar publicação Realtime de forma versionada ou documentada;
5. configurar scheduler;
6. validar RLS com dois escritórios reais de teste;
7. executar prova com UI fechada;
8. publicar frontend depois do backend;
9. observar erros, atraso do worker e duplicidades;
10. liberar produção separadamente.

Git, migration remota, Edge Function, frontend e produção são estados independentes. Não tratá-los como uma única entrega.

## 16. Matriz mínima de testes

### Domínio

- ordenação por severidade, estado e vencimento;
- agrupamento por origem;
- precedência visual;
- badge `0`, número e `99+`;
- deep links permitidos;
- mensagem sem PII excessiva.

### Banco

- abertura no instante limite;
- execução repetida sem duplicação;
- novo ciclo após reagendamento;
- encerramento automático;
- recipients corretos por papel;
- troca de responsável;
- membership bloqueada;
- duas avaliações concorrentes;
- reconhecer e resolver simultaneamente;
- evento e auditoria atômicos.

### RLS

- escritório A não lê B;
- usuário não destinatário não lê o alarme;
- `anon` não lê;
- `authenticated` não insere nem atualiza diretamente;
- assistant não recebe financeiro;
- finance não recebe conteúdo jurídico não relacionado;
- usuário removido perde acesso.

### Realtime

- insert/update chega apenas ao recipient correto;
- unsubscribe em logout/troca de escritório;
- queda de conexão recuperada por polling;
- publicação remota comprovada, não inferida.

### UX

- teclado, Escape, foco e leitor de tela;
- desktop e mobile;
- loading, vazio, erro e conexão degradada;
- leitura não resolve;
- snooze de um usuário não afeta outro;
- crítico lido continua sinalizado enquanto aberto;
- rota de origem inexistente falha com segurança.

## 17. Critérios de não regressão

- criação e edição de leads continuam funcionando;
- tarefas antigas sem responsável continuam legíveis;
- agenda e Google Calendar mantêm o contrato atual;
- financeiro mantém valores e permissões;
- portal não deve ser alterado nesta entrega;
- `Hoje` e `Dashboard` permanecem disponíveis durante modo sombra;
- mock continua opt-in;
- Firebase legado não é reativado nem expandido;
- nenhum segredo é adicionado a `VITE_*`, Git, exemplos ou logs;
- bundle não deve carregar service-role ou segredo do worker.

## 18. Regras específicas do domínio jurídico

- usar a expressão **prazo operacional cadastrado no CRM**;
- não usar “prazo processual oficial” sem fonte judicial, calendário aplicável e homologação;
- não resolver prazo sensível apenas ao ler ou reconhecer o alarme;
- alteração de data, responsável ou motivo deve ser auditável;
- futura contagem de dias úteis precisa de política própria, testes e aceite profissional;
- mensagens e metadados não devem incluir estratégia, peça, documento ou relato sensível;
- notificações externas futuras devem conter apenas contexto mínimo e link autenticado.

## 19. Condições para o executor parar e reportar bloqueio

O executor não deve improvisar quando encontrar:

- migration remota divergente da árvore local;
- ausência de credenciais ou projeto Supabase não confirmado;
- RLS que exija ampliar leitura além do destinatário;
- necessidade de tornar `service_role` acessível ao frontend;
- conflito com alterações locais do usuário nos mesmos arquivos;
- ausência de scheduler no ambiente remoto;
- regra jurídica que exija interpretação normativa;
- necessidade de enviar WhatsApp/e-mail antes da criação do outbox;
- teste cross-office ou concorrente falhando.

Nesses casos, preservar o trabalho local, registrar evidência e solicitar decisão. Não enfraquecer segurança para fazer o fluxo “funcionar”.

## 20. Definição de pronto

A Central só pode ser chamada de tecnicamente implementada quando:

- schema, RPCs, RLS, motor, recipients, frontend e testes estiverem integrados;
- alarmes surgirem e forem resolvidos com o frontend fechado;
- leitura e snooze forem pessoais;
- reconhecimento e resolução forem concorrentes e auditáveis;
- dois escritórios estiverem isolados;
- Central e KPI usarem a mesma fonte;
- lint, testes, build e `git diff --check` passarem na execução atual.

Só pode ser chamada de operacional em produção depois de:

- migrations aplicadas e verificadas no Supabase correto;
- Realtime e scheduler comprovados;
- frontend publicado depois do backend;
- prova com usuários/dados de homologação;
- observabilidade sem falhas e sem duplicação;
- aceite manual do fluxo e da apresentação.

## 21. Entrega esperada do executor

Ao terminar cada fase, responder com:

1. arquivos alterados;
2. comportamento entregue;
3. comandos executados e resultados;
4. riscos ou pendências;
5. estado separado de código local, Git, Supabase local, Supabase remoto, frontend publicado e produção;
6. próximo gate, sem avançar para publicação ou ambiente remoto sem autorização.

## 22. Registro de implementação local — 10/09/2026

Implementado localmente:

- migrações `20260910000100` a `20260910000500`, incluindo pré-requisitos, núcleo, ciclo de vida, regras e Realtime;
- `evaluate_office_operational_alarms` com idempotência, destinatários e resolução automática;
- RPCs autenticadas para leitura, snooze, reconhecimento e resolução;
- `useOperationalAlarms`, `AlarmBell`, rota `/alertas` e ações operacionais no frontend;
- Edge Function `alarm-evaluator`, protegida por segredo e capaz de avaliar um escritório ou todos;
- testes Supabase focados cobrindo idempotência, RLS, concorrência, histórico e auto-resolução.

Evidência atual: `npm run lint`, `npm run build` e `npm run test:alarms` passaram; as cinco migrações foram aplicadas no Supabase local. Scheduler remoto, deploy, Realtime em ambiente publicado e validação visual/manual continuam gates separados.
