# Operação do SaaS Presença Jurídica

## Fluxo de assinatura

1. O escritório nasce com `planCode=trial`, limites do plano Teste e 15 dias sem cartão.
2. `createCheckout` cria/recupera o cliente Asaas e cria a assinatura. A criação não é tratada como pagamento confirmado.
3. `asaasWebhook` valida o segredo, grava o evento por ID e só então atualiza o escritório.
4. Pagamento confirmado leva a `ACTIVE`; vencimento leva a `GRACE_PERIOD` por cinco dias; depois disso a reconciliação leva a `SUSPENDED`.
5. Em acesso suspenso, o cliente pode consultar, exportar e regularizar a cobrança, mas as Rules recusam mutações operacionais.

## Ciclo da equipe e dos dados

- convites expiram em sete dias, reservam vaga do plano e armazenam somente o hash do token;
- a aceitação exige login Google com o mesmo e-mail convidado;
- administradores podem bloquear/remover membros; somente o proprietário pode transferir a propriedade;
- exportação é executada por Function com escopo do escritório;
- uploads reservam cota antes do envio, são finalizados pelo backend e expiram após 15 minutos; downloads internos e do portal usam URLs assinadas por cinco minutos;
- exclusão é uma solicitação cancelável com retenção de 30 dias; a rotina diária remove os dados operacionais após o prazo e desvincula os perfis.

## Segredos e parâmetros

- `ASAAS_API_KEY`: somente Cloud Functions.
- `ASAAS_WEBHOOK_TOKEN`: cabeçalho `asaas-access-token` do webhook.
- `RESEND_API_KEY`: opcional para avisos de trial.
- `APP_URL`: origem pública usada nos convites e retornos.
- `ASAAS_BASE_URL`: use `https://api-sandbox.asaas.com/v3` na homologação e produção somente após o gate.
- `EMAIL_FROM`: remetente verificado no Resend.
- `FIRESTORE_DATABASE_ID`: banco usado pelo Admin SDK; deve coincidir com `VITE_FIREBASE_FIRESTORE_DATABASE_ID`.
- `VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY`: chave reCAPTCHA v3 do App Check.

No desenvolvimento com Functions reais, registre um token de depuração do App Check conforme a documentação do Firebase; não desative `enforceAppCheck` para contornar a configuração. No Emulator Suite, conecte explicitamente os SDKs aos emuladores antes de executar jornadas locais.

## Gate de homologação

- publicar Rules no mesmo banco configurado pelo app;
- aplicar CORS restrito ao domínio real; as Storage Rules negam acesso direto e o backend consulta o banco nomeado;
- testar isolamento com dois escritórios no Emulator Suite;
- testar criação, confirmação, vencimento, graça, suspensão, reativação e cancelamento no Asaas sandbox;
- repetir webhook idêntico e confirmar que `billingEvents/{eventId}` impede duplicidade;
- testar convite expirado, e-mail divergente, remoção e bloqueio;
- testar exportação e restauração a partir de backup real;
- autorizar o domínio do Coolify no Firebase Auth e configurar App Check;
- só depois executar o piloto com escritórios reais.

Build local e compilação das Functions não comprovam nenhum desses gates externos.
