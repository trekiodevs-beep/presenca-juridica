# E-mail transacional do CRM com Resend

O CRM usa uma conta central do Resend para enviar convites e futuras notificações em nome da plataforma. Os escritórios não precisam criar contas no Resend. O isolamento entre escritórios continua sendo feito pelo `office_id` no Supabase.

## Configuração manual única

1. Crie a conta no [Resend](https://resend.com/signup).
2. Adicione o domínio em [Domains](https://resend.com/domains).
3. Copie os registros DNS SPF, DKIM e, quando indicado, DMARC para o provedor do domínio `presencajuridica.com.br`.
4. Aguarde a validação do domínio no Resend.
5. Crie uma chave em [API Keys](https://resend.com/api-keys). A chave deve ser usada somente no Supabase.
6. No projeto Supabase, abra **Project Settings > Edge Functions > Secrets** ou use a CLI:

```powershell
supabase secrets set APP_URL=https://SEU-DOMINIO-DO-CRM `
  RESEND_API_KEY=re_xxxxxxxxx `
  EMAIL_FROM="Presença Jurídica <notificacoes@presencajuridica.com.br>"
```

7. Publique a função:

```powershell
supabase functions deploy team-invitations
```

## Fluxo implementado

- O proprietário ou administrador cria o convite na tela de equipe.
- A função cria o convite com validade de 7 dias.
- O Resend envia o e-mail usando o remetente central.
- A tela mantém o link de convite como fallback quando o provedor estiver indisponível ou ainda não configurado.
- O advogado precisa aceitar usando o mesmo e-mail destinatário.

## Validação operacional

1. Convide um endereço de teste.
2. Confirme no Resend o evento de envio/entrega.
3. Aceite o convite usando o mesmo endereço.
4. Confirme que o novo usuário aparece no escritório correto e recebeu somente as permissões da função escolhida.
5. Teste o reenvio e a revogação.

Nunca coloque `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ou tokens de convite no frontend, em `.env` público, no Git ou em logs.
