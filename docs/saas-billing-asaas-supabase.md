# Padrão replicável de cobrança SaaS — Asaas + Supabase

Este documento define o padrão de referência para SaaS brasileiros com teste gratuito, planos recorrentes, cancelamento imediato pelo cliente e backend Supabase Edge Functions. A implementação deste repositório é o exemplo operacional.

## Decisão comercial

- Teste: 15 dias, sem cartão.
- Produto: **Presença Jurídica** (`core`).
- Mensal: R$ 119,90, cobrança mensal sem período mínimo.
- Trimestral: R$ 299,70 por ciclo (R$ 99,90/mês).
- Semestral: R$ 509,40 por ciclo (R$ 84,90/mês).
- Anual: R$ 958,80 por ciclo (R$ 79,90/mês).
- Cancelamento: disponível ao proprietário/administrador; encerra cobranças futuras no Asaas e mantém o acesso até o fim do período já pago.

Os códigos de preço são estáveis e não devem ser substituídos por valores enviados pelo navegador: `core_monthly`, `core_quarterly`, `core_semiannual` e `core_annual`.

## Arquitetura

1. O frontend chama somente Edge Functions autenticadas.
2. A Function resolve o escritório pela associação ativa em `memberships`.
3. A Function consulta `billing_prices` no Supabase e cria cliente/checkout/assinatura no Asaas.
4. O navegador recebe apenas uma URL de checkout e dados de apresentação; nunca recebe `ASAAS_API_KEY` ou token de webhook.
5. O Asaas chama `billing-webhook`. O endpoint valida `asaas-access-token`, grava o evento com chave idempotente e atualiza pagamento, assinatura e cache de acesso do escritório.
6. O acesso do produto continua sendo decidido pelo estado local (`offices.subscription_status` e período), não por uma chamada síncrona ao Asaas.

## Modelo de dados

A migration `20260916000200_billing_asaas_core.sql` cria:

- `billing_products` e `billing_prices`: catálogo versionado de produto/preço.
- `billing_customers`: vínculo escritório–cliente Asaas; somente últimos quatro dígitos são persistidos.
- `billing_subscriptions`: assinatura local, período, status, método e snapshot do provedor.
- `billing_payments`: cobranças e documentos (fatura/boleto).
- `billing_checkout_sessions`: correlação entre checkout, assinatura e escritório.
- `billing_webhook_events`: inbox idempotente e auditável para reprocessamento.
- `billing_cancellation_requests`: protocolo e data efetiva do cancelamento.

Todas as tabelas possuem RLS. Leitura do catálogo e da cobrança exige associação ativa; gravações privilegiadas são feitas com service role dentro das Functions.

## Endpoints internos

| Function | Método | Finalidade |
| --- | --- | --- |
| `billing-create-checkout` | POST | Cria cliente e checkout/assinatura para um código de preço. |
| `billing-summary` | GET | Retorna estado local e histórico seguro de cobranças. |
| `billing-change-plan` | POST | Altera valor/ciclo da assinatura existente no Asaas. |
| `billing-update-method` | POST | Atualiza Pix, boleto ou cartão para cobranças futuras. |
| `billing-cancel-subscription` | POST | Cancela no Asaas e registra protocolo local. |
| `billing-webhook` | POST público | Recebe eventos Asaas com autenticação própria e idempotência. |

## Segredos e configuração

Configurar exclusivamente no projeto Supabase (nunca em `VITE_*`, Git ou logs):

```powershell
npx supabase secrets set `
  ASAAS_API_BASE_URL=https://api-sandbox.asaas.com/v3 `
  ASAAS_API_KEY="<chave do ambiente>" `
  ASAAS_WEBHOOK_TOKEN="<token aleatório com pelo menos 32 caracteres>" `
  --project-ref <project-ref>
```

Produção usa `https://api.asaas.com/v3`; sandbox usa `https://api-sandbox.asaas.com/v3`. O token configurado no Asaas deve ser igual a `ASAAS_WEBHOOK_TOKEN`.

## Configuração do Asaas

Criar o webhook apontando para:

`https://<project-ref>.supabase.co/functions/v1/billing-webhook`

Habilitar eventos de cobrança e assinatura. O webhook deve reenviar respostas não-2xx; a inbox local impede duplicidade. Nunca confiar no IP de origem como único controle.

## Implantação

```powershell
npx supabase db push --linked --project-ref <project-ref>
npx supabase functions deploy billing-create-checkout --project-ref <project-ref>
npx supabase functions deploy billing-summary --project-ref <project-ref>
npx supabase functions deploy billing-change-plan --project-ref <project-ref>
npx supabase functions deploy billing-update-method --project-ref <project-ref>
npx supabase functions deploy billing-cancel-subscription --project-ref <project-ref>
npx supabase functions deploy billing-webhook --project-ref <project-ref>
```

Validar no output da migration `Applying migration ...` e `Finished supabase db push.`. Depois executar o fluxo com sandbox: criar checkout, concluir pagamento de teste, confirmar evento no webhook, recarregar o CRM e verificar o período e o histórico.

## Contratos oficiais usados

- [Visão geral da API Asaas](https://docs.asaas.com/docs/visao-geral)
- [Autenticação Asaas](https://docs.asaas.com/docs/authentication)
- [Checkout Asaas](https://docs.asaas.com/docs/checkout-asaas)
- [Criar cliente](https://docs.asaas.com/reference/criar-novo-cliente)
- [Criar cobrança](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Assinaturas](https://docs.asaas.com/docs/assinaturas)
- [Webhooks de cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Edge Functions e autenticação Supabase](https://supabase.com/docs/guides/functions/auth)
- [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Critérios de aceite replicáveis

- Nenhuma chave Asaas aparece no bundle, no cliente ou nos logs.
- Usuário sem associação ativa recebe erro de negócio, nunca dados de outro escritório.
- Repetição do mesmo webhook não duplica pagamento nem altera o estado duas vezes.
- Pagamento confirmado ativa o plano e atualiza limites; atraso marca `PAST_DUE`; estorno/chargeback suspende.
- Cancelamento gera protocolo, remove cobranças futuras no provedor e preserva o acesso pago até `current_period_end`.
- Mensagens exibidas ao cliente usam vocabulário do produto; detalhes HTTP ficam apenas no log técnico.
- O teste distingue: código compilado, migration remota, Functions publicadas, configuração de segredos e prova E2E real.

## Adaptação para outro SaaS

Reutilizar as tabelas e Functions trocando apenas catálogo, limites, textos e `product_code`. Manter a interface de provedor (`create customer`, `create checkout`, `update subscription`, `cancel`, `webhook`) isolada em `_shared/billing.ts`; isso permite substituir Asaas sem alterar a UI ou as regras de acesso. Cada novo produto deve criar seus próprios códigos de preço versionados e uma migration aditiva.
