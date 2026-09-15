# Interface, feedback e responsividade

Este documento define o comportamento esperado da interface do Presença Jurídica CRM. Ele descreve o código disponível no repositório; publicação do frontend, aplicação de migrations e funcionamento em produção continuam sendo provas separadas.

## 1. Objetivos

- confirmar ações concluídas sem interromper o fluxo;
- manter erros importantes visíveis até o usuário dispensá-los;
- atualizar listas imediatamente após uma mutação;
- recuperar consistência quando o Supabase Realtime estiver indisponível;
- permitir uso funcional em celular sem depender de drag-and-drop;
- exigir confirmação explícita antes de ações destrutivas ou de alto impacto.

## 2. Estratégia de atualização de dados

As entidades `leads`, `tasks`, `calendar_events` e `financial_records` seguem quatro camadas complementares:

1. atualização otimista do estado React após a ação do usuário;
2. persistência no Supabase;
3. rollback local quando a persistência falha;
4. reconciliação por Realtime, atualização ao retornar para a aba e polling enquanto a página está visível.

O polling é uma recuperação de consistência e não substitui o Realtime. O listener genérico está em `src/services/supabaseDb.ts` e trata `CHANNEL_ERROR`, `TIMED_OUT` e `CLOSED`.

A migration `supabase/migrations/20260915000100_core_realtime.sql` adiciona, de forma idempotente, as quatro tabelas à publicação `supabase_realtime`. Ela precisa ser aplicada no projeto Supabase antes da validação remota.

### Comportamento do Kanban

- arrastar um contato altera a coluna imediatamente;
- sucesso gera confirmação visual;
- erro restaura a situação anterior e mantém a mensagem de erro visível;
- em telas touch ou via teclado, o seletor `Mover situação` oferece a mesma operação sem drag-and-drop.

## 3. Feedback ao usuário

O `ToastProvider`, em `src/context/ToastContext.tsx`, é o canal global para respostas transitórias:

- sucesso: confirmação curta;
- informação: orientação sem indicar falha;
- erro: mensagem persistente quando a ação pode ter deixado dúvida sobre o estado;
- no máximo quatro mensagens são mantidas simultaneamente;
- mensagens usam `role`, `aria-live` e podem ser dispensadas.

Erros em formulários públicos são apresentados no próprio formulário para preservar contexto e os dados digitados. O portal público também apresenta falha de autorização de download junto à lista de documentos.

Não usar `alert()` ou `confirm()` em novos fluxos. Ações destrutivas devem usar `ConfirmDialog`, em `src/components/ui/ConfirmDialog.tsx`, com título, consequência concreta, botão de cancelamento, estado de processamento e suporte a `Escape`.

## 4. Matriz de respostas implementadas

| Área | Ação | Resposta esperada |
| --- | --- | --- |
| Contatos | mover situação | atualização imediata, toast e rollback em erro |
| Contato | alterar situação, criar tarefa, agenda ou financeiro | confirmação ou erro visível; botão bloqueado durante envio |
| Tarefas | concluir/reabrir | atualização imediata, confirmação e rollback em erro |
| Agenda | criar, editar, alterar status ou excluir | confirmação; exclusão usa diálogo; controles bloqueados durante envio |
| Financeiro | criar ou alterar status | confirmação, erro persistente e estado de carregamento |
| Central de atenção | ler, adiar, reconhecer ou resolver | confirmação e prevenção de cliques repetidos |
| Equipe | convidar, reenviar, revogar, bloquear ou transferir | resultado visível; transferência usa confirmação explícita |
| Segurança | ativar ou remover MFA | retorno visível; remoção usa confirmação explícita |
| Privacidade | exportar, excluir ou cancelar exclusão | retorno visível; exclusão usa confirmação explícita |
| Cobrança | método, plano ou cancelamento | carregamento, confirmação e erro visível; cancelamento usa diálogo |
| Formulário público | enviar contato | sucesso dedicado; falha inline preserva os campos |
| Portal do cliente | baixar documento | botão bloqueado durante autorização e falha inline |

## 5. Responsividade

O layout principal usa a sidebar fixa somente a partir do breakpoint `lg` (`1024px`). Abaixo disso, a navegação funciona como drawer acionado pelo botão `Alternar menu lateral`.

Regras para novas telas:

- começar com uma coluna e expandir grids apenas em breakpoints adequados;
- usar `min-w-0` em filhos flex/grid que contêm textos longos;
- tabelas devem ficar dentro de `overflow-x-auto` e declarar largura mínima quando necessário;
- grupos de botões devem quebrar ou empilhar no celular;
- não esconder barras de rolagem de filtros horizontais;
- ações essenciais precisam de alternativa a hover e drag-and-drop;
- diálogos devem respeitar `w-full`, largura máxima e padding do viewport;
- testar, no mínimo, `390x844`, um viewport intermediário abaixo de `1024px` e desktop.

## 6. Validação mínima

Antes de publicar uma mudança de interface:

```powershell
npm run lint
npm test
npm run build
git diff --check
```

No navegador, validar em modo mock e depois no Supabase real:

1. ausência de rolagem horizontal global;
2. abertura, fechamento por botão e `Escape` dos diálogos;
3. bloqueio contra envio repetido;
4. toast de sucesso e erro;
5. rollback visual quando a API falha;
6. movimentação do Kanban por drag-and-drop e pelo seletor;
7. sincronização entre duas sessões autenticadas do mesmo escritório;
8. isolamento entre escritórios distintos.

## 7. Gates externos pendentes

Código, Git, migration aplicada, deploy e prova em dispositivo real são estados independentes. Para considerar a entrega operacional:

- aplicar e verificar `20260915000100_core_realtime.sql` no Supabase correto;
- aplicar `20260915000200_fix_calendar_pending_status.sql`, que mantém o evento coerente com a pendência durável criada no outbox;
- confirmar as tabelas na publicação `supabase_realtime`;
- testar alteração em duas sessões simultâneas;
- testar perda e recuperação de conexão;
- executar homologação em Android e iOS reais;
- validar leitor de tela e navegação integral por teclado;
- executar o teste automatizado que impede a reintrodução de `alert`, `confirm` ou `prompt` nativos nos fluxos cobertos.

## 8. Evidência local de 15/09/2026

- reset completo do Supabase local aplicou 26 migrations sem erro;
- publicação `supabase_realtime` contém `calendar_events`, `financial_records`, `leads` e `tasks`;
- suíte integrada `test:rls`: 17/17 aprovada;
- documentos: 3/3; calendário: 2/2; alarmes: 4/4; Functions: 4/4;
- teste funcional `test:realtime`: INSERT de lead entregue entre duas conexões locais;
- regressão de aplicação: 15/15; TypeScript e build de produção aprovados.

A primeira execução do teste Realtime evidenciou a janela de aquecimento do CDC local. O teste espera o canal ficar `SUBSCRIBED` e concede um segundo para a replicação inicializar antes do INSERT. Isso evita falso negativo da infraestrutura local sem mascarar ausência de entrega, que continua limitada por timeout.

Essas evidências comprovam o ambiente local. Elas não comprovam migration remota, Realtime remoto, deploy ou dispositivo físico.

## 9. Jornada do advogado E2E

A experiência operacional esperada segue uma continuidade única:

1. registrar ou receber um contato;
2. abrir o dossiê e realizar a triagem;
3. definir a próxima providência;
4. registrar compromisso, tarefa e lançamento financeiro quando aplicável;
5. atualizar o portal e compartilhar somente o link gerado;
6. acompanhar os reflexos em Contatos, Tarefas, Agenda, Financeiro e Hoje.

Em modo demonstrativo, o portal público deve consultar o estado persistido em `presenca-juridica-demo-v1`. Consultar apenas os dados estáticos iniciais quebra a jornada: um link recém-gerado aparece como inexistente. A função `getDemoPortalAccessByToken` mantém a visão do advogado e a visão do cliente sobre a mesma fonte persistida.

### Evidência local de 15/09/2026

- contato fictício criado pelo formulário interno, com confirmação e próxima ação visível;
- situação alterada para `Triagem realizada`, com atualização imediata, toast e evento na timeline;
- próxima providência registrada e exibida na timeline;
- compromisso criado no dossiê e localizado no dia correspondente da Agenda;
- lançamento criado no dossiê e localizado no Financeiro;
- tarefa vinculada criada e persistida na tela Tarefas;
- portal atualizado, link gerado e página pública aberta com o status e o compromisso corretos;
- nenhuma das páginas verificadas apresentou rolagem horizontal global.

O botão de WhatsApp foi conferido até a disponibilidade da ação. O envio externo não foi executado, pois permanece uma ação humana. Upload de documento, OAuth do Google, sincronização remota, isolamento entre dois escritórios reais e dispositivo físico continuam gates separados.
