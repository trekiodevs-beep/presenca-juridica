# Checklist de homologação e release

## Configuração

- [ ] `FIRESTORE_DATABASE_ID` e `VITE_FIREBASE_FIRESTORE_DATABASE_ID` apontam para o mesmo banco.
- [ ] Segredos `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `RESEND_API_KEY` configurados.
- [ ] `APP_URL`, `ASAAS_BASE_URL` e `VITE_FUNCTIONS_HEALTH_URL` configurados.
- [ ] App Check aplicado e domínio autorizado no Firebase Auth.
- [ ] CORS do bucket aplicado a partir de `storage.cors.example.json` com o domínio real.
- [ ] MFA/SMS habilitado no Firebase Authentication.

## Provas obrigatórias

- [ ] `npm run validate` aprovado e `npm run test:rules` aprovado com Java 21+.
- [ ] Dois tenants não conseguem ler ou alterar dados entre si.
- [ ] 101º contato no trial, usuário além do limite e upload além da cota são recusados.
- [ ] Upload, URL temporária interna e URL temporária do portal funcionam no navegador real.
- [ ] Convite enviado, reenviado, revogado, expirado e aceito pelo e-mail correto.
- [ ] Ciclo Asaas sandbox: checkout, Pix/boleto/cartão hospedado, confirmação, atraso, graça, suspensão, reativação, cancelamento e webhook repetido/fora de ordem.
- [ ] Avisos de trial recebidos e chamados/LGPD geram protocolos.
- [ ] Backup baixado e restauração ensaiada em projeto separado.
- [ ] Solicitação, aprovação, expiração e revogação do acesso temporário de suporte.
- [ ] Página de status monitorada externamente e alertas de Functions/erros configurados.

## Go/no-go

O release é **no-go** se qualquer prova de isolamento, cobrança, recuperação ou documento estiver pendente. Build aprovado não substitui execução externa.
