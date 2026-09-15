# Relatório UX — jornada E2E do advogado

**Sistema:** Presença Jurídica CRM  
**Data da avaliação:** 15/09/2026  
**Ambiente:** frontend local em modo demonstrativo, `390 × 844 px` e viewport padrão  
**Escopo:** experiência do advogado entre entrada do contato, organização do atendimento e disponibilização do portal ao cliente

## 1. Resumo executivo

A jornada principal está funcional no ambiente demonstrativo: o advogado consegue cadastrar o contato, triar, registrar providência, tarefa, compromisso e lançamento financeiro, gerar o portal e confirmar que o cliente visualiza as informações publicadas.

O teste encontrou uma ruptura crítica: o sistema confirmava a geração do portal, mas o link recém-criado abria como indisponível. A causa era a leitura exclusiva dos dados estáticos iniciais no portal demonstrativo. A correção passou a consultar o mesmo estado persistido usado pela visão do advogado e recebeu teste automatizado de regressão.

### Resultado técnico atual

| Indicador | Resultado observado | Situação |
| --- | ---: | --- |
| Etapas essenciais executadas | 10/10 | aprovado no modo demonstrativo |
| Etapas concluídas sem erro final | 10/10 | aprovado após correção do portal |
| Feedback visual nas mutações testadas | 6/6 | aprovado |
| Continuidade entre módulos | 5/5 | aprovado |
| Rolagem horizontal global a 390 px | 0 ocorrência | aprovado nas telas verificadas |
| Regressões automatizadas | 18/18 | aprovado |
| TypeScript | 0 erro | aprovado |
| Build de produção | concluído | aprovado |
| Usuários reais observados | 0 | não medido |
| Core Web Vitals de campo | sem telemetria | não medido |
| SUS pós-tarefa | sem participantes | não medido |

Os percentuais de 100% acima são evidência de uma execução técnica controlada, não uma taxa estatística de sucesso de usuários.

## 2. Metodologia

### 2.1 ISO 9241-11

A avaliação organiza usabilidade em três resultados:

- **eficácia:** o advogado conclui a tarefa correta e o dado aparece no destino correto;
- **eficiência:** quantidade de tempo, ações e correções necessárias;
- **satisfação:** percepção de clareza, confiança e esforço após a tarefa.

### 2.2 HEART

O acompanhamento contínuo usa as dimensões:

- **Happiness:** confiança, clareza e satisfação;
- **Engagement:** uso recorrente de contatos, tarefas e agenda;
- **Adoption:** conclusão da ativação e primeiro uso dos módulos centrais;
- **Retention:** escritórios que continuam operando após a primeira semana e o primeiro mês;
- **Task Success:** conclusão, tempo, erro, abandono e recuperação por tarefa.

Cada dimensão deve seguir `Objetivo → Sinal → Métrica`, evitando métricas sem decisão associada.

### 2.3 WCAG 2.2

O gate mínimo recomendado é WCAG 2.2 nível AA, com atenção a:

- alternativa ao movimento de arrastar;
- tamanho mínimo e espaçamento dos alvos de toque;
- foco visível e não encoberto;
- navegação e identificação consistentes;
- ajuda consistente;
- prevenção de entrada redundante;
- autenticação acessível.

### 2.4 Core Web Vitals

Para experiência percebida em produção, medir no percentil 75, separando celular e desktop:

- `LCP ≤ 2,5 s`;
- `INP ≤ 200 ms`;
- `CLS ≤ 0,1`.

Esses valores precisam vir de uso real ou de uma medição de laboratório explicitamente identificada; o build local não os comprova.

## 3. Jornada passo a passo e indicadores

### Etapa 1 — Entrar e entender o próximo passo

**Objetivo do advogado:** saber onde começar sem estudar o sistema inteiro.

**Caminho:** Login → Primeiros passos ou Hoje → ação prioritária.

**Critério de sucesso:** identificar e iniciar a ação recomendada sem ajuda externa.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Ativação essencial | escritórios com 3 marcos concluídos / escritórios iniciados | ≥ 70% em 7 dias |
| Tempo até primeira ação | mediana(`first_action_at - first_login_at`) | ≤ 5 min |
| Abandono da ativação | sessões que saem antes do primeiro marco / sessões iniciadas | ≤ 20% |
| Solicitação de ajuda | ativações com ajuda / ativações iniciadas | acompanhar; queda sem perda de sucesso |

**Eventos sugeridos:** `onboarding_viewed`, `milestone_started`, `milestone_completed`, `onboarding_completed`, `help_opened`.

### Etapa 2 — Registrar ou receber um contato

**Objetivo:** transformar uma solicitação em item operacional rastreável.

**Caminho:** Novo contato ou formulário público → confirmação → Ver contato.

**Critério de sucesso:** contato salvo uma única vez, confirmação inequívoca e acesso imediato ao dossiê.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Sucesso de cadastro | contatos salvos / tentativas válidas | ≥ 98% |
| Duplicação por clique repetido | contatos duplicados / contatos criados | < 0,5% |
| Tempo de cadastro manual | mediana(`lead_created - form_started`) | ≤ 90 s |
| Continuidade para dossiê | cliques em Ver contato / cadastros concluídos | ≥ 75% |
| Erro recuperável | tentativas concluídas após erro / tentativas com erro | ≥ 80% |

**Baseline:** cadastro local concluído; confirmação e CTA para o dossiê presentes.

### Etapa 3 — Realizar a triagem

**Objetivo:** classificar rapidamente a situação e registrar contexto suficiente.

**Caminho:** Contatos → Dossiê → Atualizar situação.

**Critério de sucesso:** card, dossiê e timeline mostram a nova situação sem recarregar a página.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Triagem no mesmo dia | contatos triados no dia / contatos recebidos no dia | ≥ 85% |
| Latência percebida da mudança | `feedback_visible_at - status_selected_at` | ≤ 300 ms local; ≤ 1 s remoto |
| Consistência de estado | atualizações iguais em card, dossiê e backend / mudanças | 100% |
| Rollback correto | falhas restauradas sem estado divergente / falhas simuladas | 100% |

**Baseline:** alteração para `Triagem realizada`, toast imediato e evento na timeline aprovados.

### Etapa 4 — Definir a próxima providência

**Objetivo:** impedir que o atendimento dependa da memória do profissional.

**Caminho:** Dossiê → Próxima providência → descrição e data → salvar.

**Critério de sucesso:** providência visível no dossiê, card e rotina correspondente.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Cobertura de providência | contatos ativos com próxima providência / contatos ativos | ≥ 90% |
| Providências vencidas | providências vencidas / providências abertas | ≤ 10% |
| Tempo triagem→providência | mediana(`next_action_created - triage_completed`) | ≤ 2 min |
| Clareza do texto | providências com verbo + objeto / providências criadas | ≥ 90% |

**Baseline:** providência salva e exibida na timeline.

### Etapa 5 — Organizar tarefas

**Objetivo:** converter obrigações em trabalho executável e vinculado ao contato.

**Caminho:** Tarefas → Criar → escolher contato → prazo → confirmar.

**Critério de sucesso:** tarefa aparece na lista correta, mantém vínculo e pode ser concluída ou reaberta.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Tarefas vinculadas | tarefas com contato / tarefas criadas | ≥ 85% |
| Conclusão no prazo | tarefas concluídas até o prazo / tarefas concluídas | ≥ 85% |
| Taxa de reabertura | tarefas reabertas / tarefas concluídas | ≤ 5% |
| Tempo para criar tarefa | mediana(`task_created - task_form_opened`) | ≤ 45 s |

**Baseline:** tarefa vinculada criada, persistida após navegação e formulário recolhido após sucesso.

### Etapa 6 — Agendar compromisso

**Objetivo:** registrar consulta, reunião, audiência, prazo ou retorno no contexto do contato.

**Caminho:** Dossiê → Agenda deste contato → criar → Agenda → selecionar o dia.

**Critério de sucesso:** compromisso aparece no dossiê e no dia correspondente da agenda geral, sem duplicidade.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Integridade dossiê→agenda | compromissos visíveis nos dois contextos / compromissos criados | 100% |
| Duplicação de compromisso | duplicados / tentativas de criação | < 0,5% |
| Tempo para localizar | mediana até abrir o compromisso na agenda | ≤ 20 s |
| Falhas de sincronização | eventos com status de erro / eventos destinados ao Google | ≤ 1% |

**Baseline:** compromisso criado no dossiê e localizado no dia 17 da agenda local. Google Calendar real não foi validado.

### Etapa 7 — Registrar financeiro

**Objetivo:** associar honorário, consulta, entrada, parcela ou despesa ao atendimento.

**Caminho:** Dossiê → Financeiro deste contato → valor, tipo, vencimento e pagamento → criar.

**Critério de sucesso:** lançamento aparece no dossiê e no Financeiro com valor e situação corretos.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Integridade do lançamento | registros iguais no dossiê e Financeiro / registros criados | 100% |
| Erro de valor/data | lançamentos corrigidos em 5 min / lançamentos criados | ≤ 2% |
| Tempo de registro | mediana(`finance_created - form_started`) | ≤ 60 s |
| Vencidos sem providência | vencidos sem tarefa ou contato recente / vencidos | ≤ 10% |

**Baseline:** lançamento de R$ 350 criado e localizado no Financeiro local.

### Etapa 8 — Atualizar o portal do cliente

**Objetivo:** compartilhar somente informações autorizadas e oferecer um próximo passo claro.

**Caminho:** Dossiê → Portal do cliente → status público → atualizar → abrir/copiar link.

**Critério de sucesso:** o link gerado abre, pertence ao contato correto e mostra somente dados liberados.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Links válidos após geração | links abertos com sucesso / links gerados | 100% |
| Vazamento de conteúdo | acessos com conteúdo não autorizado / acessos testados | 0 |
| Tempo até primeiro acesso | mediana(`portal_first_open - portal_created`) | acompanhar |
| Portal atualizado após mudança | atualizações refletidas / atualizações publicadas | 100% |

**Baseline:** uma falha crítica foi encontrada e corrigida. O link local agora abre com status e compromisso corretos, inclusive a 390 px.

### Etapa 9 — Retornar pelo WhatsApp

**Objetivo:** iniciar a conversa sem induzir que o sistema enviou mensagem automaticamente.

**Caminho:** Dossiê → Retornar pelo WhatsApp → ação humana no aplicativo externo.

**Critério de sucesso:** contato e mensagem são preparados corretamente; o envio permanece sob controle humano.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Abertura do canal | aberturas válidas / cliques no CTA | ≥ 98% |
| Retorno registrado | contatos com evento de WhatsApp / aberturas | ≥ 95% |
| Confusão sobre envio automático | respostas “achei que já tinha enviado” / participantes | 0 |

**Baseline:** CTA disponível e linguagem corrigida. O envio externo não foi executado.

### Etapa 10 — Retomar a rotina em Hoje

**Objetivo:** começar o dia sabendo o que exige atenção.

**Caminho:** Hoje → alertas → providências/tarefas → contato correspondente.

**Critério de sucesso:** a tela prioriza pendências reais e leva ao contexto de resolução.

| Indicador | Fórmula | Meta inicial |
| --- | --- | ---: |
| Pendências acionáveis | itens com destino e ação / itens exibidos | 100% |
| Resolução pela tela Hoje | itens resolvidos a partir de Hoje / itens abertos em Hoje | ≥ 60% |
| Tempo até primeira ação diária | mediana(`first_action - session_start`) | ≤ 60 s |
| Alertas falsos/obsoletos | alertas sem ação necessária / alertas exibidos | < 2% |

## 4. Scorecard HEART recomendado

| Dimensão | Objetivo | Sinal | KPI principal | Meta inicial |
| --- | --- | --- | --- | ---: |
| Happiness | advogado sente controle e confiança | avaliação pós-tarefa | CSAT da jornada | ≥ 4,2/5 |
| Happiness | interface é percebida como utilizável | questionário SUS | SUS | ≥ 80 |
| Engagement | rotina deixa de depender de memória | uso de tarefas/providências | contatos ativos com providência | ≥ 90% |
| Adoption | escritório alcança valor inicial | três marcos essenciais | ativação em 7 dias | ≥ 70% |
| Retention | operação continua no CRM | atividade em semanas posteriores | retenção W4 de escritórios ativados | ≥ 60% |
| Task Success | tarefas críticas terminam corretamente | evento terminal e ausência de rollback | sucesso por tarefa | ≥ 95%; crítico ≥ 98% |

As metas são propostas iniciais. Após quatro semanas de dados confiáveis, recalibrar por porte do escritório, perfil do usuário e origem do contato.

## 5. Índices compostos

### 5.1 Taxa de sucesso da jornada

```text
TSJ = jornadas com todas as etapas críticas concluídas / jornadas iniciadas × 100
```

Uma jornada é crítica quando chega pelo menos até `contato → triagem → próxima providência`. Portal, financeiro e agenda são condicionais ao caso e não devem penalizar fluxos em que não são necessários.

### 5.2 Eficiência normalizada

```text
EN = mediana do tempo observado / tempo-alvo
```

- `EN ≤ 1,0`: dentro da meta;
- `1,0 < EN ≤ 1,25`: atenção;
- `EN > 1,25`: investigar fricção.

### 5.3 Índice de confiança operacional

```text
ICO = 0,35 × consistência + 0,25 × feedback + 0,20 × recuperação + 0,20 × clareza
```

Cada componente é medido de 0 a 100:

- **consistência:** dado igual entre módulos e backend;
- **feedback:** ações com confirmação adequada;
- **recuperação:** falhas com mensagem, preservação dos campos e rollback;
- **clareza:** usuários que explicam corretamente o estado após a ação.

Meta inicial: `ICO ≥ 90` e nenhum componente abaixo de 85.

## 6. Instrumentação mínima

Implementar eventos sem registrar conteúdo jurídico, texto livre, telefone, e-mail ou documentos:

| Evento | Propriedades permitidas |
| --- | --- |
| `journey_started` | `office_id_hash`, `role`, `device_class` |
| `lead_created` | `source_category`, `duration_ms`, `result` |
| `lead_status_changed` | `from_status`, `to_status`, `duration_ms`, `result` |
| `next_action_created` | `has_due_date`, `duration_ms`, `result` |
| `task_created` | `has_lead`, `duration_ms`, `result` |
| `appointment_created` | `type`, `integration_mode`, `result` |
| `finance_record_created` | `type`, `has_due_date`, `result` |
| `portal_updated` | `documents_count`, `appointments_count`, `result` |
| `portal_opened` | `token_hash`, `result`, `duration_ms` |
| `toast_shown` | `operation`, `severity` |
| `operation_recovered` | `operation`, `recovery_type` |

Requisitos:

- identificadores anonimizados ou pseudonimizados;
- nenhuma captura de resumo, observação, nome, telefone ou conteúdo de documento;
- relógio monotônico para duração no frontend;
- `correlation_id` para relacionar tentativa, API, rollback e confirmação;
- distinção entre modo demonstrativo, local, homologação e produção;
- retenção e acesso compatíveis com a LGPD e a política do produto.

## 7. Protocolo de teste com advogados

### Amostra inicial

- 5 a 8 participantes para diagnóstico qualitativo por rodada;
- mistura de profissional autônomo, escritório pequeno e membro de equipe;
- pelo menos um participante com baixa familiaridade digital;
- celular e desktop reais.

### Roteiro moderado

1. “Um potencial cliente entrou em contato. Registre-o e organize o próximo passo.”
2. “Depois da triagem, marque uma consulta para outro dia.”
3. “Registre o valor combinado e o vencimento.”
4. “Disponibilize ao cliente apenas o andamento e a consulta.”
5. “No início do dia seguinte, encontre o que precisa ser feito.”

O moderador não deve ensinar o caminho. Registrar sucesso, tempo, erros, retornos, hesitações, pedidos de ajuda e frases espontâneas.

### Questionário pós-tarefa

Aplicar uma escala de 1 a 5:

- ficou claro que a ação foi concluída;
- sei onde encontrar o registro depois;
- confio que o cliente verá somente o que foi liberado;
- consigo corrigir um erro sem perder o trabalho;
- a tarefa exigiu pouco esforço.

Aplicar SUS somente após o conjunto completo de tarefas, não após cada microação.

## 8. Priorização e gates

| Prioridade | Condição | Tratamento |
| --- | --- | --- |
| P0 | perda/vazamento de dados, tenant incorreto, link público indevido | bloquear publicação |
| P1 | jornada crítica não conclui ou confirma resultado falso | corrigir antes do piloto |
| P2 | tarefa conclui com esforço, ambiguidade ou excesso de passos | corrigir na próxima rodada |
| P3 | refinamento visual sem impacto mensurável | backlog |

### Gate para piloto controlado

- sucesso ≥ 95% nas tarefas críticas;
- zero P0 e zero P1 aberto;
- WCAG 2.2 AA sem violação crítica nos fluxos essenciais;
- `LCP`, `INP` e `CLS` dentro das metas no p75;
- ao menos 5 advogados concluindo o roteiro;
- mediana de CSAT ≥ 4/5 por tarefa;
- portal e isolamento entre escritórios validados no backend real;
- WhatsApp, Google Calendar e upload testados com contas e arquivos controlados.

## 9. Próximas ações recomendadas

1. Instrumentar os eventos mínimos com proteção de dados.
2. Criar dashboard semanal com TSJ, tempo por etapa, erro e abandono.
3. Executar rodada moderada com 5 advogados.
4. Automatizar o caminho crítico em navegador: contato → triagem → providência → agenda → portal.
5. Executar Lighthouse/axe em celular e desktop e registrar o ambiente da medição.
6. Validar duas sessões do mesmo escritório e dois escritórios distintos no Supabase real.
7. Validar Google Calendar, upload e WhatsApp sem automatizar a decisão humana de envio.
8. Recalibrar as metas após quatro semanas de operação real.

## 10. Referências metodológicas

- [ISO 9241-11:2018 — Usability: Definitions and concepts](https://www.iso.org/standard/63500.html)
- [Google Research — HEART framework](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/)
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C — novidades e critérios adicionados na WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- [web.dev — Core Web Vitals](https://web.dev/articles/vitals)

