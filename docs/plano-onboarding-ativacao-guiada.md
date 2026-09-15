# Plano de implementação — onboarding e ativação guiada

## 1. Objetivo

Substituir o onboarding atual, baseado em uma lista extensa de funcionalidades, por uma jornada curta e orientada a valor:

```text
Escritório pronto → primeiro contato → próxima providência → operação iniciada
                                                       └→ Google Agenda, equipe e portal quando necessários
```

O frontend deve apresentar uma ação principal por vez, em linguagem comum. O backend deve calcular o estado real da jornada, evitar entradas redundantes, preservar progresso e recomendar a próxima ação segura.

## 2. Resultado esperado para o usuário

Uma pessoa sem experiência prévia em CRM deve conseguir:

1. entender a finalidade da configuração inicial;
2. cadastrar os dados mínimos do escritório;
3. criar ou receber um contato;
4. registrar uma tarefa ou compromisso para esse contato;
5. encontrar o contato e a providência na tela `Hoje`;
6. conectar a Google Agenda somente quando isso fizer sentido;
7. sair e retornar ao onboarding sem perder o progresso.

Meta inicial: concluir os três marcos obrigatórios em até cinco minutos, sem ajuda externa.

## 3. Princípios de produto e UX

- **Uma ação principal por contexto:** evitar várias chamadas para ação concorrentes.
- **Progressive disclosure:** recursos avançados aparecem quando se tornam relevantes.
- **Learning by doing:** ensinar por meio de uma operação real, não por textos longos.
- **Onboarding não bloqueante:** permitir `Fazer depois` e retorno posterior.
- **Linguagem de trabalho:** usar `contato`, `compromisso`, `próxima providência` e `link de atendimento`.
- **Feedback imediato:** toda ação deve terminar em sucesso, erro recuperável ou instrução objetiva.
- **Estado derivado do backend:** o frontend não decide sozinho se a operação está pronta.
- **Gamificação profissional:** progresso e celebração discreta, sem moedas, ranking ou pressão artificial.
- **Acessibilidade desde o componente:** WCAG 2.2 AA como baseline, buscando alvos de 44–48 px.
- **Sem perda de dados:** autosave quando seguro, idempotência e retomada da etapa correta.

## 4. Escopo

### 4.1 Incluído

- jornada principal com três marcos obrigatórios;
- painel com `Próximo passo`;
- checklist persistente e não bloqueante;
- estado de ativação calculado no Supabase;
- contato de exemplo idempotente;
- criação contextual de tarefa ou compromisso;
- apresentação contextual da Google Agenda;
- empty states orientados a ação;
- métricas de ativação sem conteúdo sensível;
- acessibilidade, responsividade e testes com usuários;
- compatibilidade com escritórios existentes.

### 4.2 Fora deste ciclo

- redesign completo do CRM;
- pontos, moedas, ranking ou streak diário;
- automação de mensagens por WhatsApp;
- criação automática de leads a partir de participantes Google;
- alteração dos contratos de cobrança;
- publicação automática em produção;
- mudança da regra de negócio de contatos, tarefas, portal ou financeiro.

## 5. Contrato de ativação

### 5.1 Marcos obrigatórios

| Código | Regra de conclusão | Resultado para o usuário |
|---|---|---|
| `office_ready` | escritório com nome, responsável, WhatsApp, área principal e slug válido | identidade e link de atendimento disponíveis |
| `first_contact_ready` | existe ao menos um contato ativo, real ou de exemplo | usuário entende onde as solicitações chegam |
| `first_action_ready` | existe tarefa, próxima ação ou compromisso associado a um contato | atendimento não depende da memória |

O onboarding é concluído quando os três marcos obrigatórios estão satisfeitos. Google Agenda, equipe e portal são recomendações, não bloqueios.

### 5.2 Recomendações opcionais

| Código | Quando recomendar |
|---|---|
| `connect_google_calendar` | existe compromisso e não há conexão Google ativa |
| `invite_team_member` | escritório possui somente o proprietário |
| `enable_client_portal` | existe contato com compromisso ou documento |
| `review_today` | existe contato ou providência ativa |
| `use_whatsapp_history` | contato possui telefone e nenhuma interação registrada |

### 5.3 Próxima melhor ação

Ordem determinística inicial:

1. completar escritório;
2. criar ou receber primeiro contato;
3. definir próxima providência;
4. revisar a tela `Hoje`;
5. sugerir Google Agenda se houver compromisso;
6. sugerir equipe e portal conforme o uso.

Nenhuma recomendação pode contradizer permissões, estado da assinatura ou tenant autenticado.

## 6. Arquitetura proposta

```text
AuthContext / escritório ativo
            ↓
RPC get_onboarding_state()
            ↓
OnboardingState tipado
            ↓
motor determinístico de próxima ação
            ↓
Onboarding + Hoje + empty states contextuais

Ações do usuário
    ├─ RPC idempotente para contato de exemplo
    ├─ serviços existentes para tarefa/agenda
    └─ eventos de ativação sem dados pessoais
```

### 6.1 Estado retornado ao frontend

```ts
type OnboardingStage =
  | 'office'
  | 'first_contact'
  | 'first_action'
  | 'activated';

interface OnboardingState {
  version: number;
  stage: OnboardingStage;
  completedRequired: number;
  totalRequired: 3;
  progressPercent: number;
  milestones: {
    officeReady: boolean;
    firstContactReady: boolean;
    firstActionReady: boolean;
  };
  integrations: {
    googleCalendarConnected: boolean;
    googleCalendarSelected: boolean;
  };
  recommendations: Array<{
    code: string;
    label: string;
    description: string;
    route: string;
    priority: number;
  }>;
  nextBestAction: {
    code: string;
    label: string;
    description: string;
    route: string;
  } | null;
  completedAt: string | null;
}
```

## 7. Plano de tasks

## Fase 0 — baseline e contrato

### OBG-001 — Registrar baseline funcional e preservar alterações existentes

**Tamanho:** S  
**Dependências:** nenhuma

**Trabalho:**

- registrar `git status`, branch e arquivos já modificados;
- separar as alterações locais da agenda do futuro diff de onboarding;
- executar lint, build e testes atuais disponíveis;
- registrar quais provas dependem de Supabase/Docker/credenciais;
- capturar a tela atual de onboarding em desktop e mobile quando o runtime estiver disponível.

**Critérios de aceite:**

- baseline documentado sem sobrescrever mudanças preexistentes;
- falhas históricas e falhas introduzidas distinguíveis;
- nenhum arquivo funcional alterado nesta task.

### OBG-002 — Fechar contrato de ativação e conteúdo

**Tamanho:** S  
**Dependências:** OBG-001

**Trabalho:**

- aprovar os três marcos obrigatórios;
- aprovar a ordem da próxima melhor ação;
- definir textos finais em linguagem simples;
- definir o comportamento de `Fazer depois`, `Voltar` e `Continuar configuração`;
- definir o que acontece com escritórios antigos já ativos;
- criar matriz de telas, estados vazios, loading, sucesso, erro e somente leitura.

**Critérios de aceite:**

- nenhuma integração opcional bloqueia a ativação;
- cada tela possui uma ação primária inequívoca;
- termos técnicos não aparecem na jornada principal;
- regras são testáveis e independentes de interpretação visual.

## Fase 1 — backend inteligente

### OBG-101 — Criar migration de metadados da ativação

**Tamanho:** M  
**Dependências:** OBG-002

**Arquivos prováveis:**

- `supabase/migrations/<timestamp>_onboarding_activation_state.sql`

**Trabalho:**

- adicionar em `offices`, se necessários: `onboarding_version`, `onboarding_started_at`, `onboarding_dismissed_at` e manter `onboarding_completed_at`;
- definir defaults compatíveis com escritórios existentes;
- não armazenar booleanos derivados que possam divergir das tabelas reais;
- adicionar índices somente se o plano de consulta justificar;
- revisar RLS e grants.

**Critérios de aceite:**

- migration é aditiva e reversível operacionalmente;
- escritórios existentes não são bloqueados;
- tenant não consegue consultar ou alterar metadados de outro escritório;
- rollback de aplicação não exige apagar dados.

### OBG-102 — Implementar `get_onboarding_state`

**Tamanho:** L  
**Dependências:** OBG-101

**Trabalho:**

- criar RPC autenticada e tenant-scoped;
- derivar `office_ready` a partir do escritório ativo;
- derivar `first_contact_ready` de contatos não arquivados;
- derivar `first_action_ready` de próxima ação, tarefa ou compromisso associado;
- consultar conexão Google sem expor token ou segredo;
- retornar próxima ação e recomendações ordenadas;
- marcar `onboarding_completed_at` de maneira idempotente quando os marcos forem concluídos;
- impedir que chamada de leitura promova conclusão indevida em estado somente leitura, se a política do produto assim exigir.

**Critérios de aceite:**

- duas chamadas consecutivas retornam o mesmo estado sem efeitos duplicados;
- estado reflete as tabelas reais, não caches do frontend;
- nenhum refresh token, chave ou dado de outro tenant é retornado;
- transições de marco possuem testes de fronteira.

### OBG-103 — Criar contato de exemplo de forma atômica e idempotente

**Tamanho:** M  
**Dependências:** OBG-101

**Trabalho:**

- criar RPC ou Edge Function para contato de exemplo;
- inserir contato e evento inicial na mesma transação;
- usar chave idempotente por escritório e versão do onboarding;
- retornar o ID do contato existente quando a ação for repetida;
- respeitar limites do plano e permissão `contacts.write`;
- não usar dados pessoais reais sem confirmação.

**Critérios de aceite:**

- duplo clique não cria contatos duplicados;
- falha no evento inicial não deixa contato parcialmente criado;
- tentativa sem permissão retorna erro acionável;
- contato criado aparece imediatamente no frontend.

### OBG-104 — Criar serviço frontend tipado para ativação

**Tamanho:** M  
**Dependências:** OBG-102, OBG-103

**Arquivos prováveis:**

- `src/types.ts`
- `src/services/supabaseOnboarding.ts`
- `src/hooks/useOnboardingState.ts`

**Trabalho:**

- mapear contrato da RPC;
- implementar loading, refresh, erro e retry;
- invalidar estado após criar escritório, contato, tarefa ou compromisso;
- evitar listeners globais adicionais quando uma atualização dirigida for suficiente;
- manter modo demonstrativo explicitamente separado do Supabase real.

**Critérios de aceite:**

- componentes não reimplementam regras de conclusão;
- falha de rede preserva último estado conhecido e permite tentar novamente;
- chamadas concorrentes são deduplicadas;
- nenhuma chave administrativa entra no bundle.

## Fase 2 — jornada principal no frontend

### OBG-201 — Criar shell de ativação guiada

**Tamanho:** L  
**Dependências:** OBG-104

**Arquivos prováveis:**

- `src/pages/Onboarding.tsx`
- `src/components/onboarding/ActivationProgress.tsx`
- `src/components/onboarding/NextActionCard.tsx`
- `src/components/onboarding/OptionalSetup.tsx`

**Trabalho:**

- substituir a lista plana de dez etapas por três marcos obrigatórios;
- mostrar `Próximo passo` em destaque;
- mostrar progresso textual e visual;
- adicionar `Fazer depois` e retorno persistente;
- mover integrações e recursos avançados para disclosure secundário;
- preservar rotas e componentes existentes;
- usar uma única ação primária por estado.

**Critérios de aceite:**

- usuário identifica o próximo passo em até cinco segundos no teste moderado;
- equipe, portal e Google não aparecem como bloqueios;
- refresh e novo login retomam a etapa correta;
- nenhum estado concluído depende apenas de memória local.

### OBG-202 — Simplificar a configuração inicial do escritório

**Tamanho:** L  
**Dependências:** OBG-201

**Arquivos prováveis:**

- `src/pages/Settings.tsx`
- `src/components/CityStateFields.tsx`
- componentes novos em `src/components/onboarding/`

**Trabalho:**

- criar modo de configuração inicial com apenas campos indispensáveis;
- pré-preencher nome/e-mail seguros a partir do perfil autenticado;
- sugerir slug sem expor o termo técnico;
- validar e normalizar WhatsApp;
- preservar a tela completa de configurações para edição posterior;
- salvar sem perder o conteúdo quando houver erro;
- direcionar de volta ao onboarding após sucesso.

**Critérios de aceite:**

- usuário não precisa entender `slug`;
- todos os campos possuem label persistente e exemplo útil;
- erro aparece junto ao campo e em resumo acessível;
- recarregar após salvar mantém os dados.

### OBG-203 — Implementar primeiro contato orientado por escolha

**Tamanho:** M  
**Dependências:** OBG-103, OBG-201

**Trabalho:**

- oferecer `Adicionar contato`, `Criar contato de exemplo` e `Copiar link de atendimento`;
- explicar a consequência de cada opção em uma frase;
- após criação, abrir o contato ou apresentar CTA inequívoca;
- remover ações redundantes depois que o marco estiver concluído;
- permitir substituir o contato de exemplo por uso real sem apagar histórico.

**Critérios de aceite:**

- uma única escolha é suficiente para avançar;
- contato de exemplo não duplica em repetição;
- link copiado tem feedback visual e para leitor de tela;
- usuário sempre sabe onde o contato foi salvo.

### OBG-204 — Implementar próxima providência contextual

**Tamanho:** L  
**Dependências:** OBG-201, correção vigente da criação de agenda pelo contato

**Arquivos prováveis:**

- `src/pages/LeadDetail.tsx`
- `src/context/DataContext.tsx`
- componentes em `src/components/leads/`

**Trabalho:**

- exibir a pergunta `O que precisa acontecer agora?`;
- oferecer tarefa, compromisso, WhatsApp e observação conforme permissões;
- manter o contato pré-selecionado;
- sugerir título, responsável e duração para compromisso;
- confirmar persistência pelo retorno do banco;
- mostrar onde encontrar a providência criada;
- atualizar o estado de ativação depois da operação.

**Critérios de aceite:**

- compromisso criado no contato aparece no contato e na Agenda sem refresh manual;
- tarefa aparece em Tarefas e Hoje;
- falha secundária de histórico não apaga uma ação persistida;
- duplo clique não cria registros duplicados.

### OBG-205 — Implantar empty states e ajuda contextual

**Tamanho:** M  
**Dependências:** OBG-201

**Arquivos prováveis:**

- `src/pages/Hoje.tsx`
- `src/pages/Leads.tsx`
- `src/pages/Tasks.tsx`
- `src/pages/Agenda.tsx`

**Trabalho:**

- trocar estados vazios passivos por benefício + ação;
- mostrar ajuda apenas no ponto de necessidade;
- manter `Precisa de ajuda?` em posição consistente;
- não usar tours longos nem popovers em sequência automática;
- permitir dispensar dicas e recuperá-las pela ajuda.

**Critérios de aceite:**

- toda tela vazia principal possui uma ação segura;
- dicas não encobrem controles nem capturam foco indevidamente;
- nenhuma dica reaparece continuamente após ser dispensada.

## Fase 3 — Google Agenda contextual

### OBG-301 — Reposicionar a conexão Google após o primeiro compromisso

**Tamanho:** M  
**Dependências:** OBG-204

**Trabalho:**

- após criar compromisso local, verificar estado da conexão;
- se desconectado, explicar o benefício e oferecer `Conectar` ou `Agora não`;
- informar que o compromisso já está salvo no CRM;
- manter conexão completa também em Configurações;
- não abrir OAuth automaticamente.

**Critérios de aceite:**

- recusar ou adiar Google não impede o compromisso;
- CTA só aparece quando existe contexto relevante;
- nenhum segredo ou token chega ao frontend;
- usuário entende a diferença entre `salvo no CRM` e `sincronizado com Google`.

### OBG-302 — Criar confirmação de integração e teste guiado

**Tamanho:** L  
**Dependências:** OBG-301, funções Google publicadas no ambiente de homologação

**Trabalho:**

- mostrar conta conectada e agenda selecionada;
- permitir selecionar agenda em linguagem comum;
- oferecer teste explícito e reversível;
- acompanhar `pending`, `synced`, `failed` e `conflict`;
- mostrar erro recuperável e rota de reconexão;
- não afirmar sincronização antes da confirmação remota.

**Critérios de aceite:**

- evento local aparece no Google sem duplicidade;
- estado final é visível no CRM;
- token revogado resulta em instrução de reconexão;
- falha do Google não remove o compromisso local.

## Fase 4 — gamificação profissional e métricas

### OBG-401 — Implementar marcos e celebração discreta

**Tamanho:** S  
**Dependências:** OBG-201

**Trabalho:**

- exibir progresso de 0 a 3 marcos obrigatórios;
- celebrar somente a primeira conclusão de cada marco;
- respeitar `prefers-reduced-motion`;
- remover linguagem competitiva ou infantil;
- encerrar a jornada com `Seu escritório está pronto para operar`.

**Critérios de aceite:**

- celebração não bloqueia navegação;
- animação é eliminada/reduzida conforme preferência do sistema;
- conclusão não depende de recursos opcionais.

### OBG-402 — Instrumentar funil de ativação

**Tamanho:** M  
**Dependências:** OBG-102, OBG-201

**Eventos mínimos:**

- `onboarding_started`;
- `onboarding_resumed`;
- `onboarding_step_viewed`;
- `onboarding_step_completed`;
- `onboarding_dismissed`;
- `onboarding_help_requested`;
- `onboarding_completed`;
- `calendar_connection_offered`;
- `calendar_connection_started`;
- `calendar_connection_completed`;
- `calendar_connection_failed`.

**Trabalho:**

- registrar apenas IDs técnicos, etapa, versão, timestamp e resultado;
- não registrar nome, telefone, observação ou conteúdo jurídico;
- evitar duplicidade por re-render;
- definir retenção e acesso aos eventos;
- criar consulta do funil por versão do onboarding.

**Critérios de aceite:**

- métricas não contêm dados pessoais ou conteúdo do atendimento;
- eventos têm esquema versionado;
- reabrir a tela não produz conclusão duplicada;
- é possível medir abandono por etapa e tempo até ativação.

## Fase 5 — acessibilidade e qualidade

### OBG-501 — Aplicar baseline WCAG 2.2 AA

**Tamanho:** L  
**Dependências:** OBG-201 a OBG-205

**Trabalho:**

- garantir ordem semântica de títulos;
- labels persistentes e descrições associadas;
- foco visível com contraste suficiente;
- alvos de interação de no mínimo 44 px na jornada principal;
- navegação integral por teclado;
- mensagens com `aria-live` quando apropriado;
- contraste mínimo de texto e controles;
- reflow a 320 px e zoom a 200%;
- suporte a reduced motion;
- não comunicar estado apenas por cor.

**Critérios de aceite:**

- fluxo completo operável sem mouse;
- foco nunca fica oculto;
- zoom de 200% não perde conteúdo ou ação;
- auditoria automatizada sem violações críticas, complementada por teste manual.

### OBG-502 — Testes unitários e de integração

**Tamanho:** L  
**Dependências:** OBG-102 a OBG-402

**Cobertura mínima:**

- cada combinação dos três marcos;
- seleção da próxima melhor ação;
- escritório antigo e novo;
- usuário sem permissão;
- assinatura somente leitura;
- contato de exemplo repetido;
- tarefa e compromisso criados;
- Google conectado, desconectado, sem agenda e revogado;
- isolamento entre dois escritórios;
- falha de rede e retry;
- retomada após logout/login.

**Critérios de aceite:**

- regras de backend e frontend possuem testes independentes;
- RLS impede leitura cruzada;
- testes comprovam idempotência;
- build, lint e suites relevantes passam no mesmo commit.

### OBG-503 — Teste E2E da jornada real

**Tamanho:** L  
**Dependências:** OBG-502, ambiente Supabase funcional

**Cenários:**

1. nova conta → escritório → contato → compromisso → Hoje;
2. abandonar após escritório e retomar;
3. criar contato de exemplo com duplo clique;
4. criar compromisso pelo contato e localizar na Agenda;
5. conectar Google após compromisso e confirmar evento remoto;
6. negar Google e continuar usando agenda local;
7. executar em desktop e viewport móvel;
8. executar por teclado.

**Critérios de aceite:**

- nenhum erro de console não tratado;
- nenhuma requisição crítica falha silenciosamente;
- estado persistido corresponde ao apresentado;
- evidências incluem screenshots e resultados de Network quando disponíveis.

### OBG-504 — Teste moderado com usuários

**Tamanho:** M  
**Dependências:** OBG-503

**Amostra mínima sugerida:**

- uma pessoa com baixa familiaridade digital;
- uma pessoa que usa principalmente celular;
- um advogado habituado ao Google Agenda;
- uma pessoa que nunca utilizou CRM.

**Tarefas observadas:**

- configurar escritório;
- entender para que serve o link;
- criar contato;
- agendar compromisso;
- localizar compromisso;
- explicar se está ou não no Google.

**Métricas:**

- sucesso sem ajuda;
- tempo por etapa;
- erros e retornos;
- solicitações de ajuda;
- compreensão do próximo passo;
- confiança declarada após a tarefa.

**Gate:** problemas que impedem concluir uma tarefa principal retornam à implementação antes do piloto.

## Fase 6 — rollout controlado

### OBG-601 — Compatibilidade e migração de escritórios existentes

**Tamanho:** M  
**Dependências:** OBG-102, OBG-201

**Trabalho:**

- classificar escritórios existentes pelo estado derivado;
- não reabrir onboarding obrigatório para operações já ativas;
- oferecer novo guia de forma opcional;
- manter `onboarding_completed_at` histórico;
- versionar a experiência.

**Critérios de aceite:**

- nenhuma operação existente é bloqueada;
- usuários antigos podem abrir ou dispensar o novo guia;
- estado legado não é apagado.

### OBG-602 — Piloto por escritório

**Tamanho:** M  
**Dependências:** OBG-504, OBG-601

**Trabalho:**

- habilitar onboarding v2 somente para escritórios selecionados;
- monitorar erros, abandono e tempo até ativação;
- disponibilizar rollback de frontend sem reverter migration;
- registrar feedback qualitativo;
- comparar versão anterior e nova quando houver amostra suficiente.

**Gate:** participantes, ambiente e data do piloto exigem decisão operacional explícita; esta task não autoriza publicação geral.

### OBG-603 — Liberação geral

**Tamanho:** S  
**Dependências:** OBG-602 aprovado

**Trabalho:**

- revisar métricas e feedback;
- corrigir bloqueadores do piloto;
- validar checklist de release;
- publicar de forma progressiva;
- monitorar falhas e suporte após liberação.

**Critérios de aceite:**

- redução comprovada de abandono ou tempo de ativação;
- taxa de sucesso sem ajuda dentro da meta definida;
- nenhuma regressão de tenant, agenda ou permissões;
- plano de rollback testado.

## 8. Ordem de execução

```text
OBG-001 → OBG-002
              ↓
          OBG-101
          ↙     ↘
     OBG-102   OBG-103
          ↘     ↙
          OBG-104
              ↓
          OBG-201
       ↙    ↓     ↘
 OBG-202 OBG-203 OBG-205
              ↓
          OBG-204
              ↓
          OBG-301 → OBG-302
              ↓
     OBG-401 + OBG-402
              ↓
     OBG-501 + OBG-502
              ↓
          OBG-503 → OBG-504
              ↓
          OBG-601 → OBG-602 → OBG-603
```

## 9. Definition of Done por task

Uma task somente pode ser marcada como concluída quando:

- implementação e critérios de aceite estão completos;
- lint e build passam;
- testes proporcionais ao risco passam;
- isolamento de tenant foi preservado quando aplicável;
- estados loading, vazio, sucesso e erro foram tratados;
- acessibilidade por teclado foi verificada quando há UI;
- mudanças foram revisadas sem incluir arquivos não relacionados;
- código local, Git, deploy e prova de runtime são reportados separadamente.

## 10. Métricas de sucesso

### Métricas principais

- percentual que conclui `office_ready`;
- percentual que conclui `first_contact_ready`;
- percentual que conclui `first_action_ready`;
- tempo mediano até ativação;
- taxa de ativação sem ajuda;
- abandono por etapa;
- erros por ação principal.

### Métricas secundárias

- conexão Google após primeiro compromisso;
- primeira tarefa ou compromisso criado;
- retorno ao produto no dia seguinte;
- uso da tela `Hoje` após ativação;
- solicitações de suporte relacionadas ao onboarding.

### Guardrails

- duplicidade de contatos e compromissos;
- falhas de RLS;
- aumento de erros de login/OAuth;
- perda de dados durante retomada;
- aumento de suporte por linguagem ambígua;
- queda de desempenho no carregamento inicial.

## 11. Referências de projeto

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Microsoft Fluent 2 — Onboarding: https://fluent2.microsoft.design/onboarding
- GOV.UK — Structuring forms: https://www.gov.uk/service-manual/design/form-structure
- GOV.UK — Writing for user interfaces: https://www.gov.uk/service-manual/design/writing-for-user-interfaces
- Governo Digital — Acessibilidade Digital: https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/acessibilidade-digital
- Material Design — Accessibility: https://m1.material.io/usability/accessibility.html

## 12. Primeiro incremento recomendado

Executar inicialmente apenas:

1. OBG-001 — baseline;
2. OBG-002 — contrato final;
3. OBG-101 e OBG-102 — estado inteligente;
4. OBG-104 — integração tipada;
5. OBG-201 — shell de ativação;
6. OBG-203 — primeiro contato;
7. OBG-204 — próxima providência;
8. OBG-501 e OBG-502 — qualidade mínima.

Esse incremento entrega a nova jornada principal. Google contextual, métricas, pesquisa com usuários e rollout continuam como gates próprios, sem serem apresentados como concluídos antecipadamente.
