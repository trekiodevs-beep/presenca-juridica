# Google Calendar — operação e release

Este runbook é específico do Presença Jurídica CRM. Para implementar a integração em outros sistemas ou revisar toda a arquitetura, consulte o [Guia mestre de integração com Google Calendar](guia-mestre-integracao-google-calendar.md).

## Secrets

Configure apenas no ambiente das Edge Functions:

- `GOOGLE_CALENDAR_CLIENT_ID` e `GOOGLE_CALENDAR_CLIENT_SECRET`;
- `CALENDAR_TOKEN_ENCRYPTION_KEY`: 32 bytes codificados em base64;
- `CALENDAR_SYNC_WORKER_SECRET`;
- `GOOGLE_CALENDAR_WEBHOOK_TOKEN`;
- `APP_URL` e `GOOGLE_CALENDAR_REDIRECT_URI`.

O refresh token cifrado fica somente em `calendar_connections`. Nunca copie esses valores para `VITE_*`, frontend, logs, Git ou tickets.

## Scheduler

Execute, com `CALENDAR_SYNC_WORKER_SECRET`, `calendar-sync-worker` para o lote CRM → Google e `calendar-reconcile` com `officeId` para o lote Google → CRM. O intervalo deve ser maior que o timeout do scheduler; chamadas concorrentes são protegidas por `FOR UPDATE SKIP LOCKED`.

O botão **Sincronizar agora** executa um lote limitado e cria um `calendar_sync_runs`. Falhas transitórias retornam à fila com backoff; após oito tentativas o item fica em dead-letter lógico (`dead_lettered_at`) e requer reprocessamento operacional.

## Revogação e rollback

O botão **Desconectar** chama `calendar-disconnect`: encerra o canal quando possível, revoga o refresh token, remove a conexão local de forma transacional, cancela pendências quando não há outra conexão ativa e preserva compromissos, snapshots, IDs externos e auditoria. Preservar os IDs evita duplicidade caso a mesma agenda seja conectada novamente. Se o Google estiver indisponível durante a revogação, o CRM elimina sua cópia da credencial e orienta o usuário a confirmar a remoção em `https://myaccount.google.com/connections`.

Em rollback de aplicação, mantenha as migrations aplicadas: os estados e snapshots são compatíveis com o CRUD anterior. Não faça `DROP` de eventos, outbox ou tokens para limpar falhas; corrija a pendência e reprocesse o lote.

## Homologação obrigatória

1. Aplicar migrations e conferir RLS entre dois escritórios.
2. Autorizar uma conta Google de teste e selecionar uma agenda.
3. Criar, editar, cancelar e excluir um evento no CRM; confirmar a fila e o evento remoto.
4. Criar, editar e excluir um evento no Google; confirmar importação e `deleted_external` local.
5. Alterar o mesmo evento nos dois lados e confirmar `conflict`, dois snapshots e resolução explícita.
6. Revogar o consentimento, confirmar `status = error/revoked` e validar reconexão.
