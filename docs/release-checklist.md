# Checklist de homologação e release

## Configuração

- [ ] VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY configurados no build.
- [ ] VITE_BACKEND_PROVIDER=supabase e VITE_USE_MOCK_DATA=false.
- [ ] Migrations aplicadas no projeto correto.
- [ ] Auth URLs, redirect URLs, Storage e Realtime configurados.
- [ ] Migration `20260915000100_core_realtime.sql` aplicada e publicação das tabelas confirmada.
- [ ] Secrets das Edge Functions configurados somente no backend.
- [ ] OAuth Google Calendar configurado para local e Cloud.
- [ ] Scheduler do calendar-sync-worker configurado e protegido.
- [ ] Scheduler também chama calendar-reconcile; webhook possui token, canal e expiração configurados.

## Provas obrigatórias

- [ ] npm run lint, npm test e npm run build aprovados.
- [ ] Dois tenants não conseguem ler ou alterar dados entre si.
- [ ] Papéis e convites validados.
- [ ] Upload, download temporário e portal validados.
- [ ] OAuth, seleção de agenda, CRUD, exclusão lógica, criação externa, reconciliação, retry e idempotência validados.
- [ ] Conflitos preservam snapshots e exigem decisão explícita CRM/Google/manual.
- [ ] Inbox, suporte autorizado, expiração e auditoria validados.
- [ ] LGPD, logs, backup e restauração validados.
- [ ] HTTPS, monitoramento e alertas configurados.
- [ ] Kanban atualiza sem recarregar e restaura a situação anterior quando a API falha.
- [ ] Realtime validado entre duas sessões; polling e retorno à aba recuperam desconexões.
- [ ] `npm run test:realtime` aprovado no ambiente-alvo.
- [ ] Viewports de 390x844, intermediário abaixo de 1024px e desktop sem overflow global.
- [ ] Ações essenciais funcionam por toque e teclado, sem depender de hover ou drag-and-drop.
- [ ] Toasts, erros inline, diálogos, foco, `Escape` e prevenção de duplo envio validados.
- [ ] Android e iOS reais homologados ou explicitamente marcados como não comprovados.

## Go/no-go

É no-go se isolamento, documentos, agenda, recuperação ou auditoria estiverem pendentes. Build aprovado não substitui execução externa.
