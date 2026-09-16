# Presença Jurídica CRM — Fonte de Conhecimento Canônica

> **Data da atualização:** 16/09/2026
> **Base:** `main` no commit `e54aa1d`; a publicação remota comprovada anteriormente não comprova a migration `20260916000300` nem o redeploy das Functions corrigidas nessa revisão.
> **Escopo:** fonte canônica atualizada após a implementação Asaas. A revisão `e54aa1d` foi comprovada no GitHub; migration remota, redeploy das Functions corrigidas, credenciais e pagamento Sandbox ponta a ponta continuam gates operacionais.

## 1. Resumo executivo

O código atual representa uma aplicação React/Vite cuja arquitetura vigente está orientada a **Supabase**: Supabase Auth, PostgreSQL, RLS, Storage, Realtime e Supabase Edge Functions. A camada de domínio do CRM está concentrada no frontend em `src/context/DataContext.tsx` e `src/services/supabaseDb.ts`, com persistência real prevista nas tabelas SQL versionadas em `supabase/migrations`.

A migração estrutural está **IMPLEMENTADA no código e nas migrations**, e os gates locais de compilação passaram. Isso não comprova publicação de migrations, secrets, Edge Functions, configuração externa, deploy, autenticação real, isolamento entre escritórios ou operação em produção.

O estado funcional é misto:

- **IMPLEMENTADO no código:** login Google via Supabase, escritório/membership, contatos internos, dossiê, situação, próxima providência, timeline, tarefas, agenda local, financeiro interno, upload/documentos, portal, equipe, privacidade, suporte, alertas operacionais e integrações de calendário preparadas.
- **DEMO:** caminho alternativo baseado em `VITE_USE_MOCK_DATA=true`, estado fictício em `localStorage` e `mockData.ts`.
- **PARCIAL/NÃO COMPROVADO:** upload real, portal real, Google Calendar ponta a ponta, Realtime remoto, papéis/RLS completos no ambiente remoto, suporte autorizado, e-mail transacional e pagamento real. A leitura e a criação pública de leads possuem RPCs dedicadas e foram comprovadas no Supabase local descartável; a correção Asaas está no GitHub, porém migration, redeploy e E2E de pagamento Sandbox da revisão atual ainda precisam ser comprovados.
- **IMPLEMENTADO na arquitetura vigente:** cobrança recorrente Asaas via Edge Functions, migration de catálogo/assinaturas/pagamentos, webhook idempotente, cancelamento, troca de plano e resumo de cobrança. A documentação replicável está em `docs/saas-billing-asaas-supabase.md`.

Há artefatos Firebase ainda presentes — dependência npm, `functions/`, regras, configurações e testes — mas eles não são a arquitetura de execução usada pelos serviços atuais do frontend. Devem ser tratados como **arquitetura histórica/superseded**, salvo quando citados neste documento como legado ou risco de manutenção.

## 2. Estado atual do produto

### Classificação consolidada

| Área | Estado | Evidência principal | Limite da evidência |
| --- | --- | --- | --- |
| Aplicação web | IMPLEMENTADO no pacote | `src/App.tsx`, build Vite concluído | Não prova deploy |
| Autenticação | PARCIAL | `src/context/AuthContext.tsx`, `src/services/supabaseAuth.ts` | OAuth Google real não executado |
| Escritório e onboarding | IMPLEMENTADO no código; NÃO COMPROVADO remoto | RPCs de criação/estado e `src/pages/Onboarding.tsx` | Não houve jornada autenticada nesta inspeção |
| Contatos internos | IMPLEMENTADO no código; RLS comprovado parcialmente no local | `DataContext`, `supabaseDb`, `leads` | 001C comprovou CRUD autenticado e isolamento A/B para leads; demais papéis/ambientes não cobertos |
| Entrada pública | IMPLEMENTADA e COMPROVADA no Supabase local; remoto NÃO COMPROVADO | `PublicForm`, `OfficePublicPage`, `PublicContactForm` | RPCs públicas aplicadas; cenário Realtime agregado permanece separado |
| Agenda interna | IMPLEMENTADO no código | `Agenda`, `LeadDetail`, `calendar_events` | Banco e sincronização remota não testados |
| Google Calendar | PARCIAL/PLANEJADO PARA HOMOLOGAÇÃO | 13 Edge Functions e migrations de sync | OAuth, scheduler, webhook e conta Google não comprovados |
| Financeiro interno | IMPLEMENTADO no código | `Finance`, `financial_records` | Cobrança recorrente é separada e não está conectada |
| Cobrança recorrente | CÓDIGO/GITHUB IMPLEMENTADO; RUNTIME PENDENTE | `billing-*`, migrations `20260916000200` e `20260916000300`, UI e webhook Asaas | Falta aplicar migration, redeployar Functions e executar pagamento Sandbox |
| Portal do cliente | PARCIAL | `Portal`, `PublicClientPortal`, tabela e Function de download | Acesso público real não executado |
| Documentos | PARCIAL | Storage privado, `lead_documents`, upload e signed URL | Upload/baixa/RLS não executados |
| Alertas operacionais | IMPLEMENTADO no código | tabelas, RPCs, Function e hook | Avaliação real não executada |
| Produção | NÃO COMPROVADO | Dockerfile, Nginx e runbooks | Não há prova atual de imagem, HTTPS, domínio ou healthcheck remoto |

## 3. Arquitetura atual

O fluxo previsto no código atual é:

```text
Browser React/Vite
  ├─ Supabase Auth (sessão/JWT)
  ├─ PostgREST + RLS → PostgreSQL
  ├─ Supabase Storage (bucket privado)
  ├─ Supabase Realtime → listeners por office_id
  └─ Supabase Edge Functions → OAuth, portal, equipe, suporte, privacidade, alertas e sync Google
```

O `DataContext` seleciona o escritório ativo e expõe as entidades do CRM. No modo real, `supabaseDb.ts` faz leituras, mutações e listeners; no modo demo, o contexto carrega e salva um snapshot em `localStorage`. O frontend usa a publishable/anon key e o JWT da sessão. Não foi encontrado uso de service-role key dentro de `src/`.

O pacote também mantém uma segunda arquitetura legada em `functions/src/index.ts`, baseada em Firebase Admin, Firestore, Firebase Storage e Cloud Functions. Ela não é importada pelos serviços Supabase atuais.

## 4. Stack tecnológica

- **Frontend:** React 19, TypeScript, React DOM.
- **Bundler/dev server:** Vite 6; `vite.config.ts` define code splitting para React, Motion e Recharts.
- **Roteamento:** `react-router-dom` 7, com `BrowserRouter`, rotas públicas e uma rota pai autenticada.
- **UI/CSS:** Tailwind CSS 4 via `@tailwindcss/vite`, CSS próprio em `src/index.css`, componentes locais em `src/components/ui`, ícones `lucide-react` e fonte Inter via Google Fonts.
- **Estado:** React Context (`AuthContext`, `DataContext`, `ToastContext`) e estado local dos componentes; demo persistido em `localStorage`.
- **Interação:** `@dnd-kit` para o Kanban, `motion` para animações, `recharts` para indicadores e `date-fns` para datas.
- **Backend vigente:** Supabase JS `@supabase/supabase-js`, PostgreSQL, RLS, Storage, Realtime e Edge Functions Deno/TypeScript.
- **Qualidade:** TypeScript no frontend e nas Functions legadas, testes `node:test` via `tsx`, build Vite.

## 5. Estrutura frontend

- `src/App.tsx`: composição de providers, lazy loading e rotas.
- `src/context/AuthContext.tsx`: sessão Supabase, perfil, escritório, aceite legal e saída.
- `src/context/DataContext.tsx`: carregamento por escritório, listeners, mutations e bifurcação demo/real.
- `src/services/supabaseAuth.ts`: Auth, perfil, escritório e RPC de criação do escritório.
- `src/services/supabaseDb.ts`: mapeadores, CRUD, listeners, Storage, portal e calendário.
- `src/services/supabaseTeam.ts`: convites, membros e transferência de propriedade via Function.
- `src/services/supabasePrivacy.ts`, `supabaseRequests.ts`, `supabaseSupportAccess.ts`, `supabaseAdmin.ts`, `supabaseAlarms.ts`: funções de privacidade, suporte, administração e alertas.
- `src/hooks/useOperationalAlarms.ts`: leitura/atualização dos alertas e recuperação por polling.
- `src/pages`: 26 telas, incluindo CRM interno, rotas públicas, configurações, portal, billing, equipe, suporte, segurança e administração.
- `src/components`: layout, formulário público, Kanban, alerta, cidades/UF, aceite legal e componentes UI.

O layout autenticado redireciona usuário sem sessão para `/login`, exige aceite da versão legal corrente e envia usuário autenticado sem escritório para `/settings`. As rotas públicas são declaradas fora do layout autenticado.

## 6. Arquitetura Supabase

### Objetos encontrados

- **Migrations:** 28 arquivos em `supabase/migrations`, de `20260909000100_initial_core.sql` a `20260915000400_public_lead_creation_contract.sql`.
- **Tabelas públicas:** 25.
- **Functions SQL públicas distintas:** 28 nomes encontrados nas migrations, com algumas redefinições posteriores.
- **Policies:** 42 declarações `CREATE POLICY`, incluindo três policies em `storage.objects`.
- **Views/materialized views:** nenhuma declaração encontrada.
- **Enums PostgreSQL:** nenhuma declaração `CREATE TYPE ... AS ENUM` encontrada; o modelo usa `text`, `check constraints`, `jsonb` e arrays.
- **Buckets declarados:** um bucket privado, `lead-documents`.
- **Edge Functions:** 18 diretórios funcionais, mais `_shared/cors.ts` e `_shared/email.ts`.
- **Realtime:** habilitado em `supabase/config.toml`, com publicação idempotente por migration e listeners `postgres_changes` no frontend.

## 7. Autenticação

**IMPLEMENTADO no código / NÃO COMPROVADO em runtime.**

- Supabase Auth mantém sessão, refresh automático e detecção de sessão no retorno OAuth (`src/lib/supabase.ts`).
- O login atual chama `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- O perfil é lido/criado em `public.profiles`, ligado a `auth.users(id)`.
- O escritório é recuperado pelo `profiles.office_id`.
- Aceite de termos e privacidade é persistido em `profiles` com versão e timestamp.
- Login é registrado por `record_audit_event` quando há escritório.
- A UI ainda apresenta caminho de MFA, mas `mfaChallengePending` permanece `false` e `completeMfaLogin` lança erro informando que o MFA legado Firebase não está disponível após a migração. Portanto MFA não é uma capacidade atual comprovada.

## 8. Modelo multi-tenant

O tenant é o escritório (`offices.id`). As entidades operacionais carregam `office_id`; o vínculo usuário–escritório é mantido em `memberships`, com espelho de `office_id` e `role` em `profiles`.

As funções SQL `is_office_member` e `has_office_role` são `SECURITY DEFINER`, possuem `search_path = public`, consultam membership ativa e são usadas pelas policies RLS. O fluxo de onboarding usa `create_office_with_owner(jsonb)` para criar escritório, membership `owner` e atualizar o perfil no mesmo fluxo transacional da função.

**Classificação:** desenho multi-tenant **IMPLEMENTADO**; isolamento de leads entre dois escritórios foi **COMPROVADO no Supabase local pelo 001C**; isolamento remoto/produção e todos os papéis continuam **NÃO COMPROVADOS**. A presença de `office_id` e RLS é evidência de mecanismo, não prova de comportamento isolado em banco publicado.

## 9. Banco de dados

### Entidades e relacionamentos

| Entidade | Finalidade | Tenant/usuário | Relacionamentos e uso |
| --- | --- | --- | --- |
| `profiles` | perfil do usuário autenticado | `id = auth.users.id`, `office_id`, `role` | dono/membro; usado no Auth e permissões |
| `offices` | escritório, plano, trial, onboarding e configuração pública | `owner_user_id` | pai de quase todas as entidades |
| `memberships` | vínculo usuário–escritório e papel | `office_id`, `user_id` | base de isolamento e autorização |
| `leads` | contatos e dossiê operacional | `office_id`, `responsible_user_id` | referencia `offices`, `profiles`; origem do atendimento |
| `lead_events` | timeline do contato | `office_id`, `lead_id`, `created_by` | referencia contato e perfil |
| `tasks` | providências executáveis | `office_id`, `lead_id`, `responsible_user_id`, `created_by` | referencia contato e usuários |
| `calendar_events` | compromissos internos e externos | `office_id`, `lead_id`, `responsible_user_id` | possui estado/origem/sync Google |
| `calendar_connections` | conexão Google por usuário/escritório | `office_id`, `user_id` | refresh token cifrado e agenda selecionada |
| `calendar_sync_outbox` | fila CRM → Google | `office_id`, `calendar_event_id` | retry, lock, dead-letter lógico |
| `calendar_event_snapshots` | snapshots para reconciliação/conflito | vínculo por evento/escritório | somente leitura do cliente |
| `calendar_sync_runs` | execução de reconciliação/sync | `office_id` | histórico operacional |
| `calendar_oauth_states` | state OAuth de uso único | `office_id`, `user_id` | sem acesso anon/auth direto |
| `public_forms` | configuração da entrada pública | `office_id` | lida pela tela pública e alterada por gestor |
| `usage_counters` | contadores de usuários, contatos e Storage | `office_id` | leitura autenticada do escritório |
| `lead_documents` | metadados de documentos | `office_id`, `lead_id`, `uploaded_by` | arquivo físico no Storage privado |
| `client_portal_access` | token/acesso e conteúdo liberado do portal | `office_id`, `lead_id` | leitura pública condicionada a ativo/expiração |
| `financial_records` | lançamentos financeiros internos | `office_id`, `lead_id` | consulta pelo contato e Financeiro |
| `invitations` | convites de equipe | `office_id`, `created_by`, `accepted_by` | token armazenado como hash |
| `support_tickets` | chamados de suporte | `office_id`, `user_id` | escritos pela Edge Function |
| `privacy_requests` | solicitações de titular LGPD | sem `office_id` obrigatório | processadas pela operação/admin |
| `support_access_requests` | autorização temporária de suporte | `office_id`, solicitante/decisor | aprovação/revogação auditável |
| `audit_logs` | auditoria de ações | `office_id`, `actor_user_id` | leitura de membro do escritório |
| `operational_alarms` | alertas persistentes | `office_id`, usuário atribuído | origem em lead/tarefa/agenda/financeiro/etc. |
| `operational_alarm_events` | histórico de transições do alerta | `office_id`, `alarm_id`, ator | leitura por destinatário |
| `operational_alarm_recipients` | destinatários e estado pessoal | `office_id`, `user_id`, `alarm_id` | leitura própria; base do sino |

### Índices, constraints e triggers

Foram encontrados índices por escritório em contatos, eventos, tarefas, agenda, financeiro, documentos, portal, memberships, convites, suporte e alertas. Há índices específicos para fila de sincronização, conflitos e `syncToken`/execuções do calendário.

As PKs são UUID, exceto `public_forms.slug` e `client_portal_access.id` textuais. FKs usam `cascade`, `set null` ou restrição conforme a entidade. Estados de assinatura, papel, status, origem e sync são `text` com `check constraints`.

Triggers `set_updated_at` estão presentes em perfis, escritórios, memberships, leads, agenda, fila, documentos, financeiro, convites, suporte e alertas. Triggers de calendário preparam e enfileiram sincronização após alteração do evento; migrations posteriores redefinem esses triggers para corrigir ordem e status pendente.

## 10. RLS e autorização

**Mecanismo IMPLEMENTADO; prova comportamental COMPROVADA parcialmente no Supabase local pelo 001C, ainda NÃO COMPROVADA no remoto/produção.**

- RLS é habilitado nas 25 tabelas públicas declaradas nas migrations.
- Leitura de dados operacionais normalmente usa `is_office_member(office_id)`.
- Escrita operacional usa `has_office_role` para `owner`, `admin`, `lawyer` e `assistant`; financeiro inclui `finance`; portal inclui operadores; gestão de escritório/equipe fica em `owner`/`admin`.
- `calendar_connections`, `calendar_sync_outbox`, snapshots e runs têm acesso de cliente restringido ou somente leitura controlada.
- `calendar_oauth_states` revoga acesso de `anon` e `authenticated`.
- Suporte, privacidade, administração global e operações sensíveis passam por Edge Functions que validam JWT/papel e usam service role somente no backend.
- O bucket Storage é privado; policies usam o primeiro segmento do caminho como `office_id` e roles permitidos.

### Contrato público e limite remanescente

`public_forms` continua sem policy de SELECT para `anon`. A migration `20260915000300_public_form_public_contract.sql` criou a RPC `get_public_form_by_slug(text)` como contrato público dedicado. Ela valida o slug, filtra `is_active = true`, retorna somente a allowlist usada pelas rotas públicas e recebe `GRANT EXECUTE` para `anon, authenticated` após `REVOKE ALL` de `public`.

`PublicForm.tsx` e `OfficePublicPage.tsx` continuam consultando `getPublicFormBySlug` sem sessão, agora por essa RPC. A resposta vazia para slug inexistente/inativo é convertida pelas páginas em estado controlado de indisponibilidade.

`PublicContactForm.tsx` agora envia somente `slug`, dados de contato, área, consentimento, origem e UTM para `createPublicLead`. A migration `20260915000400_public_lead_creation_contract.sql` criou a RPC `create_public_lead(...)` com `SECURITY DEFINER`, `search_path` explícito, validação server-side, resolução `slug → public_forms → office_id`, filtro de formulário ativo, defaults administrativos (`status`, `priority`, `responsible_user_id`, `notes`, `created_via`, timestamps) e retorno mínimo de `lead_id/success`. Não há policy `INSERT anon` em `leads`, nem evento público em `lead_events`; o CRUD autenticado existente foi preservado.

Assim, a **leitura e a criação pública estão IMPLEMENTADAS e COMPROVADAS no Supabase local descartável**, mas não no projeto remoto/produção. A UI mantém confirmação, CTA manual de WhatsApp e mensagem genérica de erro; detalhes SQL/policy não são apresentados ao visitante. Rate limiting avançado, CAPTCHA e idempotência permanecem fora do 001C.

### Evidência real do gate 001C

O stack local `presenca-juridica-local` estava ativo em Docker. As migrations `20260915000300` e `20260915000400` foram aplicadas em ordem e registradas em `supabase_migrations.schema_migrations`. A consulta do catálogo confirmou as duas RPCs com `EXECUTE` para `anon`/`authenticated` e sem `EXECUTE` para `public`; RLS está habilitado em `public_forms`, `leads` e `lead_events`, sem policy pública de escrita/leitura direta.

O teste dedicado `tests-supabase/public-entry.test.ts` passou **9/9**: leitura allowlisted do formulário ativo, slug inexistente/inativo, ausência de leitura/listagem direta anon, criação válida, derivação cross-tenant, consentimento inválido, campos administrativos, UTM, repetição sem idempotência, insert direto anon negado, `lead_events` negado, CRUD autenticado e isolamento entre usuários/escritórios. Fixtures `codex-001c-*` foram removidas no teardown; verificação posterior retornou `forms=0`, `leads=0`, `memberships=0`, `offices=0`.

## 11. Storage e arquivos

**PARCIAL/NÃO COMPROVADO.**

- Bucket `lead-documents`: privado, limite de 50 MiB.
- Caminho criado pelo frontend: `{officeId}/{leadId}/{uuid}-{nome seguro}`.
- Metadados persistem em `lead_documents`; falha no insert remove o objeto recém-enviado.
- Download interno usa signed URL de 300 segundos.
- Download do portal passa pela Edge Function `portal-document-download`, RPC `get_portal_document_path` e signed URL de 300 segundos.
- A autorização do portal verifica token ativo/não expirado, contato correto, documento visível e presença do ID no JSON de documentos liberados.
- Upload, download, Storage remoto, limite de arquivo e isolamento entre tenants não foram executados nesta inspeção.

## 12. Edge Functions / RPC / backend

### Edge Functions encontradas

`alarm-evaluator`, `calendar-conflict-resolve`, `calendar-connection-status`, `calendar-event-delete`, `calendar-list`, `calendar-oauth-callback`, `calendar-oauth-start`, `calendar-reconcile`, `calendar-select`, `calendar-sync-now`, `calendar-sync-worker`, `calendar-webhook`, `platform-admin`, `portal-document-download`, `privacy-controls`, `support-access`, `support-requests` e `team-invitations`. Os compartilhados são `cors.ts` e `email.ts`.

As Functions cobrem OAuth Google, listagem/seleção de agenda, sync CRM → Google, reconciliação Google → CRM, webhook, conflito, portal-documento, convites, suporte, privacidade, administração global e alertas. `email.ts` integra Resend por secret.

Muitas Functions estão configuradas com `verify_jwt = false` em `supabase/config.toml`, mas o código implementa validação própria de Authorization, usuário, membership ou secret de worker. Essa combinação exige homologação externa; a configuração não é por si só prova de segurança.

### RPCs e funções SQL principais

Foram encontradas funções de membership/autorização (`is_office_member`, `has_office_role`), criação/onboarding (`create_office_with_owner`, `get_onboarding_state`, `create_onboarding_example_contact`), auditoria (`record_audit_event`), portal (`get_portal_document_path`), ownership (`transfer_office_ownership`), fila/calendário (`enqueue_calendar_sync`, `claim_calendar_sync_outbox`, `enqueue_calendar_sync_for_office`, `prepare_calendar_event_sync`, `mark_calendar_event_deleted`, `set_calendar_remote_state`, `create_calendar_remote_event`, `calendar_event_payload`) e ciclo/regras de alertas (`upsert_operational_alarm`, `evaluate_office_operational_alarms`, `acknowledge_operational_alarm`, `resolve_operational_alarm` e funções auxiliares).

## 13. Rotas públicas

Declaradas em `src/App.tsx`, fora do layout autenticado:

- `/login`
- `/public/:officeSlug/contact`
- `/o/:officeSlug`
- `/portal/cliente/:token`
- `/convite/:token`
- `/legal/:document`
- `/status`

`/public/:officeSlug/contact` e `/o/:officeSlug` são públicas por roteamento e usam a RPC pública dedicada para leitura; migration aplicada, grants e carregamento anon ainda não foram comprovados em runtime. O envio do formulário continua pendente conforme seção 10. `/portal/cliente/:token` tem policy pública de leitura de portal ativo e expiração; não houve teste real.

## 14. Rotas autenticadas

Todas ficam sob `/` e `Layout`:

`/`, `/onboarding`, `/leads`, `/leads/new`, `/leads/:id`, `/tarefas`, `/agenda`, `/financeiro`, `/portal`, `/canais`, `/dashboard`, `/settings`, `/billing`, `/equipe`, `/privacidade`, `/admin`, `/suporte`, `/seguranca` e `/alertas`.

O roteamento não substitui RLS/backend authorization. A proteção de tela é UX; autorização de dados e mutações deve continuar no Supabase/Functions.

## 15. Módulos funcionais

| Jornada/módulo | Classificação | Evidência atual |
| --- | --- | --- |
| Login | PARCIAL | Google OAuth Supabase; demo bypass; MFA legado sem implementação atual |
| Onboarding/configuração do escritório | IMPLEMENTADO no código | Settings, RPC de criação e onboarding de três marcos |
| Hoje | IMPLEMENTADO no código | prioridades, tarefas, agenda, contatos e central de atenção |
| Contatos | IMPLEMENTADO no código; integração NÃO COMPROVADA | CRUD/listeners Supabase e Kanban/lista |
| Cadastro manual | IMPLEMENTADO no código | `NewLead` → `DataContext.addLead` |
| Entrada pública | IMPLEMENTADA e COMPROVADA no Supabase local; remoto NÃO COMPROVADO | leitura e criação por RPCs allowlisted; sem INSERT anon direto |
| Dossiê do contato | IMPLEMENTADO no código | `LeadDetail`: situação, providência, notas, timeline, tarefas, agenda, financeiro, docs e portal |
| Situação/triagem | IMPLEMENTADO no código | status tipados, update e evento de timeline |
| Próxima providência | IMPLEMENTADO no código | texto/data, destaque em Hoje e registro na timeline |
| Histórico/timeline | IMPLEMENTADO no código | `lead_events` e listeners |
| WhatsApp | IMPLEMENTADO como ação manual | links `wa.me`, mensagem editável e evento de abertura; não envia via API |
| Tarefas | IMPLEMENTADO no código | criação, vínculo, conclusão/reabertura e listener |
| Agenda interna | IMPLEMENTADO no código | CRUD, vínculo ao contato, status, exclusão lógica e fila de sync |
| Google Calendar | PARCIAL/PLANEJADO PARA HOMOLOGAÇÃO | OAuth/sync/reconcile/conflict codificados; runtime externo não comprovado |
| Financeiro | IMPLEMENTADO no código | `financial_records`, tela Finance e lançamento no dossiê |
| Cobrança/assinatura | CÓDIGO/GITHUB IMPLEMENTADO; RUNTIME/E2E PENDENTES | catálogo versionado, checkout, assinatura, cancelamento e webhook Asaas |
| Portal do cliente | PARCIAL | geração, atualização, link, preview e rota pública; runtime/RLS não comprovados |
| Configurações | IMPLEMENTADO no código | escritório, endereço público, mensagem WhatsApp e Google Calendar |
| Canais de entrada | IMPLEMENTADO; entrada pública comprovada localmente | links, cópia, página pública e teste interno; ambiente remoto não comprovado |
| Dashboard/indicadores | IMPLEMENTADO no código | gráficos e métricas derivadas dos dados carregados |
| Upload/documentos | PARCIAL | código de upload e Storage privado; sem teste real |
| Conversão contato → cliente | NÃO ENCONTRADO | não há entidade/rota de conversão específica |
| Clientes | NÃO ENCONTRADO como módulo independente | cliente existe apenas dentro de `lead`/portal |
| Processos | NÃO ENCONTRADO | não há tabela, rota ou service de processos jurídicos |
| Administração global | IMPLEMENTADO no código; NÃO COMPROVADO | `platform-admin` e `Admin.tsx`, protegidos por `global_role` |
| Privacidade/LGPD | PARCIAL | aceite, consentimento, exportação, exclusão agendada e solicitações; sem teste externo |
| Suporte | PARCIAL | tickets e acesso temporário com aprovação; Function/secrets não homologados |
| Alertas | IMPLEMENTADO no código; NÃO COMPROVADO | regras, ciclo, destinatários, sino, Realtime e polling |

## 16. Jornada principal do advogado

O caminho previsto e codificado é:

```text
Login → escritório/onboarding → Contatos → Dossiê
  → triagem → próxima providência → tarefa/agenda/financeiro
  → portal do cliente → ação manual no WhatsApp → Hoje/Alertas
```

O relatório UX local de 15/09/2026 registra 10/10 etapas no modo demonstrativo, feedback 6/6, continuidade 5/5, 390×844 sem rolagem horizontal nas telas verificadas e 18/18 regressões automatizadas naquele momento. Após os gates 001A/001B/001C, a suíte local de produto passou com 30/30 e a prova real da entrada pública passou com 9/9. Esses resultados são evidência de execução controlada/local e não medem usuários reais, produção, OAuth, Storage ou entrega de WhatsApp.

## 17. Portal do cliente

**PARCIAL.**

O advogado seleciona um contato em `Portal.tsx`, define status público, observações, pendências, documentos visíveis, compromissos liberados e estado ativo. O sistema grava `client_portal_access`, gera o link `/portal/cliente/:token`, permite copiar/abrir e prepara compartilhamento manual no WhatsApp.

O portal público apresenta somente o snapshot liberado em status, observações, pendências, agenda e documentos. A baixa de documento usa autorização server-side e URL assinada.

Não existe autenticação de cliente separada: o acesso é bearer token em URL. A policy `client_portal_public_read` permite leitura `anon, authenticated` de qualquer registro ativo e não expirado; a aplicação filtra por ID/token na consulta. Isso precisa de validação de enumeração, rate limiting, revogação e exposição mínima antes de ser classificado como seguro.

## 18. Modo demonstrativo

O modo é selecionado em build por `VITE_USE_MOCK_DATA=true`. `AuthContext` usa `mockUser`/`mockOffice`; `DataContext` usa `readDemoData`/`saveDemoData` e a chave `presenca-juridica-demo-v1` no `localStorage`. O demo carrega contatos, eventos, tarefas, documentos, agenda, financeiro e acessos de portal fictícios. `PublicClientPortal` usa `getDemoPortalAccessByToken` no modo mock.

Há helpers demo para formulário público (`getDemoPublicForm`, `createDemoPublicLead`) em `src/lib/demoStore.ts`, mas as telas `PublicForm.tsx`, `OfficePublicPage.tsx` e `PublicContactForm.tsx` atualmente importam/acionam diretamente os serviços Supabase e não esses helpers. Portanto a separação demo/real é **PARCIAL** no caminho público.

O repositório documenta `silva-advogados-demo` e 15 contatos iniciais. A mesma origem e perfil de navegador são necessários para compartilhar o snapshot. O localStorage não representa autenticação nem isolamento multi-tenant e não deve receber dados reais.

## 19. Modo real

O modo real é selecionado por `VITE_USE_MOCK_DATA=false` e exige `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para considerar Supabase configurado. O `.env.local` inspecionado contém `VITE_USE_MOCK_DATA=false` e URL local `127.0.0.1`; isso não prova que um Supabase local está ativo.

No código, o frontend real lê/escreve Postgres via Supabase JS, usa Realtime e chama Edge Functions para operações sensíveis. No repositório, o script Vite padrão usa a porta 3000; Docker/Nginx usa 8080. Não foi encontrada confirmação no código para uma arquitetura oficial nas portas `3010` e `3011`; essas portas devem permanecer **NÃO COMPROVADAS**.

## 20. Integrações externas

- **Google OAuth/Calendar:** codificado em Edge Functions, com refresh token cifrado, `calendar_connections`, fila, sync incremental, snapshots, conflitos e reconciliação. OAuth, webhook, scheduler, secrets, `events.watch` e uso bidirecional real não foram comprovados.
- **WhatsApp:** links `wa.me` com mensagem pré-preenchida; ação humana no aplicativo externo. Não há API oficial de envio no frontend atual.
- **Resend:** integração server-side em `_shared/email.ts` e uso por convites; API key e domínio não foram comprovados.
- **Asaas:** integração vigente está em `supabase/functions/billing-*`, com segredos server-side, catálogo versionado, checkout, assinatura, cancelamento e inbox idempotente de webhook. `functions/src/index.ts` permanece legado Firebase e não deve ser usado para novas cobranças.
- **IBGE/municípios:** `CityStateFields.tsx` consulta sugestões de município; não há prova de disponibilidade externa durante esta auditoria.
- **Coolify/Docker/Nginx:** Dockerfile, Compose, healthcheck `/healthz` e instruções existem; imagem, deploy, domínio e HTTPS não foram comprovados.

## 21. UX e nomenclatura oficial

As decisões abaixo foram encontradas no código/testes atuais:

- “próxima providência” é o vocabulário padrão do dossiê, onboarding, Hoje e timeline;
- “Canais de entrada” aparece na sidebar/topbar e na rota `/canais`;
- “Endereço público do escritório” é usado em Configurações, em vez de expor “slug” como termo principal;
- links públicos são apresentados após existir escritório/endereço salvo;
- o formulário público confirma “Contato enviado com sucesso” antes de oferecer “Conversar pelo WhatsApp”;
- a ação WhatsApp é descrita como conversa manual, sem alegar envio automático;
- contadores operacionais vazios são ocultados em cartões conforme teste de consistência;
- o formulário de tarefa é recolhido quando já existem tarefas, conforme teste de consistência;
- o dossiê usa painéis sticky no desktop (`xl:sticky`);
- a navegação móvel usa drawer em breakpoint `lg`, com alternativa de toque para o Kanban;
- não foi encontrado CTA duplicado de “Novo contato” na sidebar; há ações no Topbar e nas telas onde fazem sentido;
- o banner de trial é componente próprio e o fluxo usa mensagens simplificadas de acesso.

## 22. Segurança e LGPD

### Controles presentes no código

- JWT/Supabase Auth para sessão autenticada.
- RLS por tenant e role, com helpers `SECURITY DEFINER` de escopo limitado.
- Service role reservado às Edge Functions e ao ambiente server-side.
- Bucket de documentos privado e URLs assinadas de curta duração.
- Token de convite armazenado como hash.
- Auditoria de login e ações sensíveis.
- Aceite versionado de termos/privacidade.
- Campo de consentimento LGPD no lead público.
- Solicitações de acesso, correção, exclusão, portabilidade, informação e revogação.
- Exportação e exclusão agendada por Edge Function, com janela de segurança indicada na UI.
- Acesso temporário de suporte sujeito a solicitação, aprovação, expiração e revogação.

### Classificação de risco

- **COMPROVADO:** nenhum segredo service-role foi encontrado em `src/` ou bundle fonte inspecionado.
- **PARCIAL:** desenho de RLS, Storage, auditoria e funções de autorização está presente; 001C comprovou RLS/isolamento somente para o fluxo de leads testado localmente.
- **NÃO COMPROVADO:** policies no ambiente remoto/produção, todos os papéis e tabelas, logs remotos, segredo configurado, expiração real e resposta a incidentes.
- **RISCO:** as RPCs públicas foram comprovadas localmente, mas precisam ser aplicadas/homologadas no Supabase remoto; rate limiting/CAPTCHA/idempotência ainda não existem; portal bearer-token tem policy pública ampla; artefatos Firebase/Asaas legados aumentam risco de configuração equivocada; UI de MFA legado pode induzir expectativa de controle inexistente.

Este documento não constitui parecer jurídico nem avaliação completa de conformidade LGPD. Os textos legais do produto precisam de revisão jurídica antes de uso comercial.

## 23. Testes e qualidade

### Scripts encontrados

```text
npm run lint              → tsc --noEmit
npm test                  → tsx --test tests/*.test.ts
npm run build             → vite build
npm --prefix functions run build → tsc
npm run test:rls          → tsx --test tests-supabase/*.test.ts
npm run test:functions    → Functions Supabase
npm run test:documents    → Storage/documentos Supabase
npm run test:calendar     → calendário Supabase
npm run test:alarms       → alertas Supabase
npm run test:realtime     → Realtime Supabase
npm run test:rules        → emulador histórico Firestore
```

### Execução nesta inspeção

| Comando | Resultado observável |
| --- | --- |
| `npm run lint` | PASS; `tsc --noEmit` sem saída de erro |
| `npm test` | PASS; 30/30 testes, 0 falhas |
| `npm run build` | PASS; Vite transformou 3.603 módulos e produziu `dist/` |
| `npm --prefix functions run build` | PASS; compilação TypeScript da camada Firebase legada |
| `git diff --check` | PASS; somente avisos de conversão LF/CRLF |
| `npx tsx --test tests-supabase/public-entry.test.ts` | PASS; 9/9 cenários reais 001C, fixtures removidas no teardown |
| `npm run test:rls` | PARCIAL; 26/27 testes passaram; falha isolada em `tests-supabase/realtime.test.ts` por timeout de evento em 8 segundos, fora do 001C |
| `npm run test:functions` | EXECUTADO dentro de `npm run test:rls`; os testes correspondentes passaram |
| `npm run test:documents` | EXECUTADO dentro de `npm run test:rls`; os testes correspondentes passaram |
| `npm run test:calendar` | NÃO EXECUTADO; ausência de `SUPABASE_SERVICE_ROLE_KEY` |
| `npm run test:alarms` | EXECUTADO dentro de `npm run test:rls`; os testes correspondentes passaram |
| `npm run test:realtime` | EXECUTADO dentro de `npm run test:rls`; falha isolada por timeout de evento em 8 segundos em `tests-supabase/realtime.test.ts` |
| `npm run test:rules` | sem resultado TAP utilizável nesta execução; suíte é Firestore histórica |

Os 30 testes locais cobrem contratos Edge Function, domínio SaaS, rollback/update otimista, Realtime por contrato, consistência UX, regressão do portal demo, leitura pública e criação pública por contrato estático. A prova adicional 001C acessou o Supabase local real e cobriu anon, autenticação, RLS e isolamento multi-tenant; ela não prova alinhamento do ambiente remoto/produção.

## 24. Estado de deploy

**NÃO COMPROVADO nesta inspeção.**

O repositório contém Dockerfile multi-stage Node 22 + Nginx, porta 8080, fallback SPA e `/healthz`. README e runbooks citam Coolify/GitHub e Supabase externo. Isso comprova somente preparação versionada.

Não foi verificado nesta etapa:

- imagem Docker construída e executada;
- aplicação publicada no Coolify;
- domínio/HTTPS;
- variáveis Vite do build remoto;
- migrations remotas alinhadas;
- Edge Functions publicadas;
- secrets Google/Resend/worker configurados;
- Auth redirect URLs;
- scheduler/webhook;
- healthcheck e jornada em produção.

Uma anotação operacional anterior registrou aplicação remota da migration de onboarding em 14/09/2026, mas essa informação não foi refrescada por consulta live nesta auditoria e não deve ser tratada como prova atual de todo o schema/deploy.

## 25. Débitos técnicos

- Separar e completar o caminho demo das rotas públicas, ou remover helpers demo não utilizados.
- Homologar no Supabase remoto as RPCs públicas de leitura e criação; adicionar rate limiting/antispam em gate próprio.
- Substituir ou remover dependência, regras, config e Functions Firebase quando a retirada do legado for autorizada.
- Executar e registrar o E2E Sandbox do Asaas; configurar webhook de produção antes da ativação comercial.
- Completar validação live de RLS com dois escritórios e todos os papéis.
- Homologar Storage, portal, signed URLs, expiração e enumeração de tokens.
- Homologar scheduler, webhook, OAuth, token expirado, `410 Gone`, retry, dead-letter e conflitos do Google Calendar.
- Exibir snapshots na revisão de conflito se essa for a experiência pretendida; hoje “Revisar” apenas mostra orientação textual.
- Corrigir/decidir o contrato de Realtime remoto e a recuperação após desconexão.
- Adicionar validação live de limites de plano, contadores e concorrência.
- Confirmar se `profiles.office_id` como escritório único atende a eventual multi-membership futuro; memberships permitem relação múltipla, mas o perfil atual mantém um único escritório ativo.
- Revisar consistência entre README/runbooks e código atual, especialmente Asaas, Cloud Functions, Firebase e estado de demo.

## 26. Riscos atuais

1. **P0 potencial — ambiente remoto não homologado:** leitura e criação foram comprovadas no Supabase local, mas o projeto remoto/produção ainda pode estar sem migrations, grants, RLS ou funções alinhadas.
2. **P1 — portal bearer token:** leitura pública é ampla para registros ativos; o risco depende de entropia, não enumeração, expiração, revogação e rate limiting não comprovados.
3. **P1 — divergência de backends:** Firebase legado continua compilável e documentado enquanto o frontend vigente usa Supabase; deploy equivocado pode publicar serviços incompatíveis.
4. **P1 — cobrança:** a revisão Asaas está publicada no GitHub, mas sem prova da migration/redeploy atuais nem de pagamento Sandbox, recebimento de webhook e ativação automática do plano.
5. **P1 — produção não demonstrada:** build local não prova migrations, secrets, Functions, domínio, HTTPS ou runtime.
6. **P2 — demo inconsistente:** portal usa localStorage no mock, mas entrada pública ainda chama Supabase; um roteiro demonstrativo pode depender de estado/ambiente incorreto.
7. **P2 — MFA legado:** existe UI e contrato de contexto, mas não há implementação Supabase atual.
8. **P2 — integrações Google:** código extenso não prova scheduler, webhook, OAuth aprovado, tokens, watch renewal ou sync bidirecional.

## 27. Funcionalidades planejadas

São tratadas como PLANEJADO ou gate de homologação, não como entregues:

- publicação e homologação do Supabase remoto; o contrato foi comprovado no stack local descartável;
- rate limiting, CAPTCHA, idempotência e demais hardenings da entrada pública;
- dois escritórios descartáveis para teste de isolamento;
- OAuth Google e sincronização bidirecional em conta controlada;
- scheduler e webhook de calendário;
- resolução de conflito baseada em snapshots;
- upload, download, portal e expiração em Storage real;
- cobrança Asaas integrada ao backend vigente;
- e-mail Resend com domínio validado;
- teste real de papéis, convites, transferência, suporte autorizado e auditoria;
- telemetria mínima de jornada sem conteúdo jurídico;
- Lighthouse/axe, dispositivos reais e métricas de campo;
- pilotos com advogados e retenção/HEART após operação real;
- módulo independente de clientes, conversão e processos, que não foi encontrado no código atual.

## 28. Fora de escopo atual

Não foram encontrados como entregues no repositório atual: módulo processual jurídico, cadastro independente de clientes, automação oficial de envio de WhatsApp, MFA Supabase, emissão de documentos jurídicos, assinatura eletrônica, integração bancária, analytics de produção, monitoramento de Core Web Vitals, scheduler versionado no repositório e prova de deploy/produção.

## 29. Arquitetura histórica superseded

Os itens seguintes permanecem no checkout, mas não devem ser lidos como backend vigente:

- Firebase Authentication;
- Cloud Firestore;
- Firestore Rules;
- Firebase multi-tenant baseado em documentos `users`, `offices`, `memberships` e coleções Firestore;
- Firebase Storage e `storage.rules`;
- Cloud Functions Node em `functions/src/index.ts`;
- integração Asaas implementada nessa camada Firebase;
- testes `tests-rules/firestore.rules.test.ts` e script `npm run test:rules`;
- `firebase.json`, `firebase-blueprint.json`, `firebase-applet-config.json`, `firestore.indexes.json`, `firestore.rules` e `storage.rules`;
- dependências `firebase`, `firebase-admin`, `firebase-functions` e `@firebase/rules-unit-testing`.

`docs/demo-comercial.md` e alguns trechos de README ainda contêm referências Firebase ou Cloud Functions. Elas devem ser interpretadas como documentação histórica/inconsistente até serem atualizadas em tarefa própria. A arquitetura atual documentada neste arquivo é Supabase.

## 30. Próximos gates recomendados

1. **Gate de contrato público:** CONCLUÍDO no Supabase local; repetir no ambiente remoto antes de qualquer classificação de produção.
2. **Gate de schema:** manter o schema local reproduzível com 28 migrations e aplicar as mesmas migrations no ambiente remoto controlado.
3. **Gate multi-tenant:** validar dois escritórios e papéis `owner`, `admin`, `lawyer`, `assistant`, `finance` e `read`, incluindo leitura, insert, update e delete.
4. **Gate autenticado:** testar login Google, aceite legal, criação de escritório, onboarding, logout e recuperação de sessão.
5. **Gate de jornada:** validar especificamente contato → dossiê → triagem → próxima providência → tarefa/agenda/financeiro → portal.
6. **Gate de arquivos/portal:** validar upload, visibility, signed URL, token inválido/expirado, revogação e tentativa cross-tenant.
7. **Gate Google:** validar OAuth, seleção, CRUD nos dois sentidos, scheduler, webhook, retries, `410 Gone`, conflitos e auditoria.
8. **Gate comercial:** concluído em código/publicação; falta homologar checkout, cobrança, webhook, cancelamento e estado somente leitura no Sandbox.
9. **Gate de deploy:** construir Docker, publicar em ambiente de homologação, conferir `/healthz`, HTTPS, Auth URLs, Functions, secrets e migrations.
10. **Gate UX/uso real:** repetir mobile/desktop com navegador/dispositivo real, acessibilidade, feedback, dupla ação e recuperação de desconexão.
11. **Gate de piloto:** somente após zero P0/P1 aberto, isolamento real, portal/Storage/Google testados e participantes humanos concluírem o roteiro.

## Evidências finais

### Arquivos e áreas inspecionados

- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `Dockerfile`, `nginx.conf`, `docker/compose.yml`, `README.md`.
- `.env`, `.env.local`, `.env.example`, `.env.docker.example`, sem expor valores secretos.
- `src/App.tsx`, contexts, services, hooks, `src/types.ts`, `src/lib`, todas as páginas e componentes relevantes.
- `supabase/config.toml`, 28 migrations, 18 Edge Functions e compartilhados; 28 migrations foram confirmadas no histórico local após a prova 001C.
- `functions/package.json`, `functions/src/index.ts` e arquivos Firebase legados.
- `tests/*.test.ts`, `tests-supabase/*.test.ts`, `tests-rules/*.test.ts`.
- `docs/demo-comercial.md`, `docs/deploy-producao.md`, `docs/calendar-google-operacao.md`, `docs/relatorio-ux-jornada-advogado-e2e.md` e runbooks relacionados.

### Inventários

- Migrations encontradas: 28.
- Tabelas encontradas: 25.
- Policies encontradas: 42; três são de `storage.objects`.
- Buckets encontrados: `lead-documents`, privado, 50 MiB.
- Edge Functions encontradas: 18, além de `_shared/cors.ts` e `_shared/email.ts`.
- Rotas encontradas: 7 públicas declaradas e 18 rotas sob o layout autenticado.
- Módulos encontrados: CRM de contatos/dossiê, onboarding, Hoje, tarefas, agenda, financeiro, portal, canais, dashboard, configurações, equipe, billing, privacidade, administração, suporte, segurança e alertas.

### Comandos executados

```text
git status --short --branch
rg --files
rg -n (inventários de Firebase/Supabase, rotas, SQL, integração e UX)
npm run lint
npm test
npm run build
npm --prefix functions run build
npm run test:rls
npm run test:functions
npm run test:documents
npm run test:calendar
npm run test:alarms
npm run test:realtime
git diff --check
npm run test:rules
```

### Estado Git no início/fim da inspeção

O checkout estava em `main...origin/main`, com alterações locais pré-existentes em documentação, pacote, páginas, contexts, services, testes, migrations e componentes UI. Nesta tarefa foram adicionados a migration, o contrato TypeScript, o ajuste do service, os usos tipados nas duas rotas públicas e os testes específicos; nenhuma alteração foi revertida, commitada ou publicada.

### Caminho do documento

`docs/FONTE_CONHECIMENTO_PRESENCA_JURIDICA_ATUAL.md`

**Critério de aceite:** a fonte canônica está baseada no código/migrations atuais, separa Supabase de Firebase histórico, classifica recursos por evidência e mantém explícitos os gates não comprovados. A auditoria termina aqui para revisão; não iniciar implementação a partir deste documento sem novo escopo autorizado.
