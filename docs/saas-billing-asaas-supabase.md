# Padrão replicável de cobrança SaaS — Asaas + Supabase

Este documento define o padrão reutilizável de integração Asaas + Supabase e registra sua implementação concreta no CRM Presença Jurídica. As seções de arquitetura, segurança, idempotência, implantação e homologação podem ser adaptadas a outros SaaS; catálogo, preços, textos, limites e regras comerciais pertencem a este produto.

Atualizado em **04/11/2026**. Jornada publicada no CRM; pagamento trimestral com cartão confirmado no Asaas Sandbox e plano ativo confirmado pelo usuário na interface. O teste exigiu conciliação do incidente; a correção automática publicada em `898cb5b` ainda precisa ser comprovada em nova contratação sem intervenção.

## Estado comprovado

| Camada | Estado | Evidência/pendência |
| --- | --- | --- |
| Código e GitHub | PUBLICADO | `main` em `898cb5b` para a correção de checkoutSession; TypeScript e 49 testes aprovados |
| Frontend / Coolify | PUBLICADO | Escolha do plano antes da etapa de pagamento; tela nova confirmada no domínio do CRM |
| Banco | APLICADO | Migrações de integridade e `20261104194945_billing_hosted_checkout_customer.sql` presentes remotamente |
| Edge Functions | ACTIVE | `billing-create-checkout` v10, `billing-webhook` v10 e `billing-summary` v8 |
| Webhook | ENTREGA COMPROVADA | Eventos CHECKOUT e PAYMENT recebidos e persistidos |
| Cartão trimestral | PAGAMENTO E ACESSO CONFIRMADOS | R$ 299,70 CONFIRMED; assinatura/escritório ACTIVE após conciliação; usuário confirmou a interface |
| Automação corrigida | VALIDAÇÃO PENDENTE | Repetir contratação para comprovar ativação sem conciliação manual |
| Pix e boleto | E2E PENDENTE | Criação, confirmação e ativação ainda precisam de testes completos |

Detalhes e histórico: [relatório de 04/11/2026](RELATORIO_JORNADA_PAGAMENTO_2026-11-04.md). O teste utiliza o CRM publicado com Asaas Sandbox; não comprova operação financeira no Asaas Produção.

## Decisão comercial

- Teste: 15 dias, sem cartão.
- Produto: **Presença Jurídica** (`core`).
- Mensal: R$ 119,90, cobrança mensal sem período mínimo.
- Trimestral: R$ 299,70 por ciclo (R$ 99,90/mês).
- Semestral: R$ 509,40 por ciclo (R$ 84,90/mês).
- Anual: R$ 958,80 por ciclo (R$ 79,90/mês).
- Cancelamento: disponível ao proprietário/administrador; a remoção da assinatura no Asaas também remove cobranças pendentes e vencidas. O CRM preserva localmente o acesso somente até `current_period_end` quando esse período já estiver pago. Essa regra precisa de aceite comercial explícito antes de produção.

Os códigos de preço são estáveis e não devem ser substituídos por valores enviados pelo navegador: `core_monthly`, `core_quarterly`, `core_semiannual` e `core_annual`.

## Arquitetura

1. O frontend chama somente Edge Functions autenticadas.
2. A Function resolve o escritório pela associação ativa em `memberships`.
3. A Function consulta `billing_prices`; preço, ciclo e descrição nunca são aceitos como autoridade do navegador.
4. Assinatura `PENDING` e sessão são persistidas antes do recurso remoto. No cartão, o cliente local é vinculado após a coleta de dados pelo Checkout; Pix/boleto vinculam o cliente antes da criação da assinatura.
5. Cartão usa Checkout recorrente hospedado; Pix e boleto usam assinatura direta e consulta da primeira cobrança.
6. O navegador recebe somente a URL hospedada pelo Asaas e identificadores operacionais; nunca recebe `ASAAS_API_KEY` ou token de webhook.
7. O Asaas chama `billing-webhook`. O endpoint valida `asaas-access-token`, persiste o evento pelo `id` e só então atualiza Checkout, assinatura, pagamento e cache de acesso.
8. O acesso do produto é decidido pelo estado local (`offices.subscription_status` e período), não por uma chamada síncrona ao Asaas.

### Fluxo de criação

1. Validar usuário, associação ativa e papel `owner`/`admin`.
2. Validar `priceCode` e forma de pagamento. CPF/CNPJ é solicitado no CRM somente para Pix/boleto.
3. Para Pix/boleto, localizar ou criar o cliente Asaas por `externalReference = officeId`. No cartão, deixar o Checkout coletar identificação, endereço e dados do cartão.
4. Persistir `billing_subscriptions(PENDING)` e `billing_checkout_sessions(CREATED)` com `subscription_id`.
5. Para `CREDIT_CARD`, enviar `POST /checkouts` com:
   - `chargeTypes: ["RECURRENT"]`;
   - `minutesToExpire: 60`;
   - `externalReference` igual ao ID da sessão local;
   - `callback.successUrl`, `cancelUrl` e `expiredUrl`;
   - valor somente em `items`;
   - ciclo e vencimento em `subscription`.
6. Persistir `checkout.id`, ler `checkout.link` e devolver a URL ao frontend.
7. Para `PIX` ou `BOLETO`, criar `POST /subscriptions`, persistir imediatamente o ID remoto e consultar `/subscriptions/{id}/payments`. A ausência temporária da URL retorna `202`, sem criar outra assinatura.

Exemplo resumido do payload recorrente:

```json
{
  "billingTypes": ["CREDIT_CARD"],
  "chargeTypes": ["RECURRENT"],
  "minutesToExpire": 60,
  "externalReference": "<billing_checkout_sessions.id>",
  "callback": {
    "successUrl": "https://crm.trekio-tecnologia.com.br/billing?checkout=success",
    "cancelUrl": "https://crm.trekio-tecnologia.com.br/billing?checkout=canceled",
    "expiredUrl": "https://crm.trekio-tecnologia.com.br/billing?checkout=expired"
  },
  "items": [{
    "name": "Presença Jurídica — Trimestral",
    "description": "Assinatura do CRM jurídico",
    "quantity": 1,
    "value": 299.70
  }],
  "subscription": {
    "cycle": "QUARTERLY",
    "nextDueDate": "AAAA-MM-DD"
  }
}
```

O redirecionamento para `successUrl` é apenas navegação. A confirmação financeira vem de `CHECKOUT_PAID` e dos eventos de pagamento.

## Modelo de dados

As migrations `20260916000200_billing_asaas_core.sql` e `20260916000300_billing_checkout_integrity.sql` criam:

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
| `billing-update-method` | POST | Alterna Pix/boleto nas cobranças pendentes e futuras. Troca de cartão não está implementada. |
| `billing-cancel-subscription` | POST | Cancela no Asaas e registra protocolo local. |
| `billing-webhook` | POST público | Recebe eventos Asaas com autenticação própria e idempotência. |

### Contratos do frontend

- `billing-create-checkout`: `{ priceCode, billingType, payer: { cpfCnpj } }`.
- `billing-change-plan`: `{ priceCode }`; altera cobranças pendentes e futuras com `updatePendingPayments: true`.
- `billing-update-method`: `{ billingType: "PIX" | "BOLETO" }`; cartão retorna `409 credit_card_update_not_implemented`.
- `billing-cancel-subscription`: corpo vazio; retorna `status`, `effectiveAt` e `protocol`.
- `billing-summary`: não recebe dados financeiros sensíveis e devolve somente a projeção segura local.

Na contratação, o proprietário ou administrador escolhe primeiro o plano. A segunda etapa mostra o total do período e a escolha do método. Para cartão, identificação, endereço e cartão são coletados no Asaas, sem enviar `customer` incompleto na criação do Checkout. Pix/boleto solicitam CPF/CNPJ nessa segunda etapa. Cartão usa Checkout recorrente hospedado (`CREDIT_CARD`); Pix e boleto usam assinatura Asaas com a primeira cobrança recuperável. Pix de assinatura requer pagamento manual a cada ciclo e não equivale a Pix Automático. A tela apresenta a tentativa `PENDING`, o link original do provedor e, para Pix, QR Code/copia e cola quando disponíveis. O botão de atualizar consulta o estado local e pode reprocessar um `CHECKOUT_PAID` persistido com falha para o escritório autenticado; callback de navegador não confirma pagamento. Uma tentativa pendente não é substituída automaticamente por outra enquanto o resultado financeiro não estiver conciliado.

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

`APP_URL` deve apontar para a origem pública do frontend. Na ausência dessa variável, o código usa `https://crm.trekio-tecnologia.com.br`.

## Configuração do Asaas

Criar o webhook apontando para:

`https://<project-ref>.supabase.co/functions/v1/billing-webhook`

Configuração mínima recomendada:

- `enabled: true`;
- `apiVersion: 3`;
- `sendType: SEQUENTIALLY`;
- `authToken` igual a `ASAAS_WEBHOOK_TOKEN`;
- Checkout: `CHECKOUT_CREATED`, `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`;
- assinaturas: ao menos `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED`, `SUBSCRIPTION_DELETED`;
- pagamentos: eventos de criação, confirmação/recebimento, atraso, estorno e chargeback usados pelo produto.

O webhook exige `id` e `event`, aceita atributos adicionais e usa `(provider, provider_event_id)` como chave única. Eventos `PROCESSED`/`IGNORED` retornam `200` como duplicados. Eventos `FAILED` são reabertos, incrementam `attempt_count` e retornam `500` enquanto o processamento falhar, permitindo o retry do Asaas. O Asaas considera apenas HTTP `200` como entrega bem-sucedida e aplica penalidade progressiva à fila após falhas; por isso `FAILED` deve gerar alerta operacional e correção rápida.

### Correlação de eventos

Eventos de pagamento e assinatura do Checkout trazem `checkoutSession`; esse campo é associado a `billing_checkout_sessions.provider_checkout_id`. O webhook também recupera pagamentos pelos eventos persistidos quando a consulta ao provedor não resolve a relação. Um evento confirmado sem aplicação financeira local não deve ser considerado prova de ativação.

### Mapeamento de eventos

| Evento | Efeito local esperado |
| --- | --- |
| `CHECKOUT_CREATED` | sessão permanece `OPEN` |
| `CHECKOUT_PAID` | sessão `PAID`; assinatura e escritório `ACTIVE`; período reconciliado |
| `CHECKOUT_CANCELED` | sessão e assinatura pendente `CANCELED` |
| `CHECKOUT_EXPIRED` | sessão `EXPIRED`; assinatura pendente `CANCELED` |
| pagamento confirmado/recebido | `billing_payments` por upsert; assinatura/escritório `ACTIVE` |
| pagamento vencido | assinatura `PAST_DUE` |
| estorno/chargeback | assinatura `REFUNDED` ou `SUSPENDED` |
| `SUBSCRIPTION_*` | snapshot, método e próximo vencimento reconciliados |

Não confiar no IP de origem como único controle e não registrar CPF/CNPJ completo, cartão, chave ou token. Erros do provedor são reduzidos a código e descrição sanitizados.

## Implantação

```powershell
npx supabase db push --linked
npx supabase functions deploy billing-create-checkout --project-ref <project-ref>
npx supabase functions deploy billing-summary --project-ref <project-ref>
npx supabase functions deploy billing-change-plan --project-ref <project-ref>
npx supabase functions deploy billing-update-method --project-ref <project-ref>
npx supabase functions deploy billing-cancel-subscription --project-ref <project-ref>
npx supabase functions deploy billing-webhook --project-ref <project-ref>
```

Validar no output da migration `Applying migration ...` e `Finished supabase db push.`. Depois executar o fluxo com sandbox: criar checkout, concluir pagamento de teste, confirmar evento no webhook, recarregar o CRM e verificar o período e o histórico.

Após cada deploy, conferir no projeto Supabase que a Function está `ACTIVE` e executar um `OPTIONS`/request real quando aplicável. Commit, push e CI verde não substituem essa verificação.

## Mudança de plano, método e cancelamento

- Mudança de plano envia `updatePendingPayments: true`; portanto altera propriedades suportadas das cobranças pendentes e das futuras. Para cartão, valor/vencimento podem exigir tokenização habilitada pelo Asaas.
- Mudança de método suporta somente Pix e boleto. Troca de cartão exige `PUT /subscriptions/{id}/creditCard`, tokenização/dados seguros e `remoteIp` do dispositivo do pagador; ela não está disponível na UI atual.
- Cancelamento registra primeiro um protocolo local `REQUESTED`, marca a projeção como `CANCEL_AT_PERIOD_END`, executa `DELETE /subscriptions/{id}` e então confirma `SCHEDULED`. Se o Asaas falhar, a projeção é revertida.
- O `DELETE` é definitivo e remove cobranças pendentes ou vencidas da recorrência. Cobranças pagas permanecem registradas. A preservação de acesso até `current_period_end` é uma decisão do CRM e precisa corresponder a um período efetivamente pago.

## Diagnóstico operacional

| Sintoma | Verificar primeiro |
| --- | --- |
| `400` no Checkout | array `errors` sanitizado; campos obrigatórios; ambiente da chave; payload recorrente |
| `401` do Asaas | chave e `ASAAS_API_BASE_URL` pertencem ao mesmo ambiente |
| `checkoutUrl` vazio | resposta deve conter `link`; confirmar versão publicada da Function |
| `CHECKOUT_PAID` sem ativação | `billing_webhook_events`, `provider_checkout_id`, `subscription_id` e migration `00300` |
| evento preso em `FAILED` | `last_error`, `attempt_count`, logs da Function e logs do webhook no Asaas |
| boleto sem URL | aguardar geração da primeira cobrança; não repetir automaticamente a criação |
| plano local diferente da cobrança | conferir `updatePendingPayments`, snapshot e eventos posteriores |
| webhook `401` | comparar `asaas-access-token` com `ASAAS_WEBHOOK_TOKEN` |

## Contratos oficiais usados

- [Visão geral da API Asaas](https://docs.asaas.com/docs/visao-geral)
- [Autenticação Asaas](https://docs.asaas.com/docs/authentication)
- [Checkout Asaas](https://docs.asaas.com/docs/checkout-asaas)
- [Checkout recorrente](https://docs.asaas.com/docs/checkout-with-subscription-recurring)
- [Criar Checkout](https://docs.asaas.com/reference/criar-novo-checkout)
- [Eventos de Checkout](https://docs.asaas.com/docs/eventos-para-checkout)
- [Criar cliente](https://docs.asaas.com/reference/criar-novo-cliente)
- [Criar cobrança](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Assinaturas](https://docs.asaas.com/docs/assinaturas)
- [Atualizar assinatura](https://docs.asaas.com/reference/atualizar-assinatura-existente)
- [Atualizar cartão](https://docs.asaas.com/reference/atualizar-cartao-de-credito-assinatura)
- [Remover assinatura](https://docs.asaas.com/reference/remover-assinatura)
- [Webhooks de cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [FAQ de Webhooks](https://docs.asaas.com/docs/webhooks-faq)
- [Edge Functions e autenticação Supabase](https://supabase.com/docs/guides/functions/auth)
- [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Estado e critérios de aceite

Estado atual: **PAGAMENTO TRIMESTRAL COM CARTÃO E ACESSO CONFIRMADOS NO SANDBOX APÓS CONCILIAÇÃO**. A ativação automática corrigida, Pix, boleto e os cenários abaixo ainda exigem validação própria.

- Nenhuma chave Asaas aparece no bundle, no cliente ou nos logs.
- Usuário sem associação ativa recebe erro de negócio, nunca dados de outro escritório.
- Repetição do mesmo webhook não duplica pagamento nem altera o estado duas vezes.
- `CHECKOUT_PAID` e pagamento confirmado ativam o plano; atraso marca `PAST_DUE`; estorno/chargeback suspende.
- Cancelamento gera protocolo antes da mutação remota; falha do provedor reverte a projeção local. A remoção no Asaas e a preservação local do período pago devem ser verificadas no Sandbox.
- Mensagens exibidas ao cliente usam vocabulário do produto; detalhes HTTP ficam apenas no log técnico.
- O relatório de homologação distingue: código compilado, migration remota, Functions publicadas, configuração de segredos e prova E2E real.

## Pendências obrigatórias de homologação

- Repetir contratação de cartão e comprovar ativação automática usando `checkoutSession`, sem conciliação manual.
- Validar cancelamento e expiração do Checkout.
- Testar Pix e boleto do início até a ativação.
- Forçar uma falha de processamento, comprovar `FAILED`, repetir o mesmo `id` e comprovar `PROCESSED` com `attempt_count > 1`.
- Testar boleto com URL inicialmente indisponível e comprovar que não surge uma segunda assinatura remota.
- Validar cancelamento com cobrança pendente/vencida e obter aceite formal da regra comercial.
- Implementar uma jornada segura para `PUT /subscriptions/{id}/creditCard` antes de oferecer troca de cartão.

## Adaptação para outro SaaS

Reutilizar as tabelas e Functions trocando apenas catálogo, limites, textos e `product_code`. Manter a interface de provedor (`create customer`, `create checkout`, `update subscription`, `cancel`, `webhook`) isolada em `_shared/billing.ts`; isso permite substituir Asaas sem alterar a UI ou as regras de acesso. Cada novo produto deve criar seus próprios códigos de preço versionados e uma migration aditiva.
