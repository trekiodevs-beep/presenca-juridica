# Relatório de implementação e publicação — jornada de pagamento

**Data:** 04/11/2026
**Sistema:** Presença Jurídica
**Integrações:** Asaas Sandbox, Supabase e Coolify
**Estado:** código e funções publicados; contratação ponta a ponta ainda não homologada.

## 1. Contexto

O fluxo anterior abria um checkout recorrente do Asaas apenas com cartão. O bloqueio de popup no navegador e a persistência de uma assinatura local `PENDING` podiam impedir uma nova tentativa. Também houve um checkout expirado sem evento de webhook enquanto a configuração do webhook no Asaas estava desativada. A implementação atual permite a escolha explícita da forma de pagamento na interface e apresenta o pagamento pendente para retomada.

## 2. O que foi implementado

### Interface e contrato com o backend

- A tela de cobrança solicita a escolha entre **cartão de crédito, Pix e boleto** antes da contratação de um novo plano.
- O navegador segue para a URL de pagamento na mesma aba, sem depender de popup.
- A tela mostra o pagamento pendente, a ação para continuar, o QR Code e o código copia e cola quando o Asaas os fornece, além da atualização manual do estado.
- O serviço do frontend envia a forma de pagamento escolhida e trata a resposta `202` quando o link ainda não está disponível. Mensagens de conflito `409` distinguem plano ou método diferente de uma tentativa pendente.

### Funções Supabase

- `billing-create-checkout`: cartão usa o Checkout recorrente hospedado do Asaas; Pix e boleto criam uma assinatura no Asaas e consultam a primeira cobrança. O fluxo reutiliza o cliente Asaas já vinculado ao escritório e registra os identificadores locais e do provedor.
- `billing-summary`: devolve o estado pendente e, quando disponíveis, o link da cobrança, o QR Code e o código Pix. O link de cartão é recuperado do estado salvo enquanto o checkout local está aberto e dentro do prazo.
- `billing-webhook`: recebe eventos com token próprio, persiste o evento para idempotência e atualiza checkout, pagamento, assinatura e acesso. Para `CHECKOUT_PAID`, consulta os pagamentos da sessão no Asaas para associar a assinatura recorrente; se a associação falhar, retorna erro para permitir reprocessamento em vez de ativar uma assinatura sem vínculo confirmado.
- A URL retornada ao navegador é restringida a HTTPS em domínio Asaas.

Não foi criada migração de banco nesta alteração. As funções de mudança de plano, troca de método e cancelamento não foram modificadas.

## 3. Publicação verificada

| Componente | Estado verificado em 04/11/2026 |
| --- | --- |
| GitHub `main` | Commit `e8bf36cd6b90c1eda577946cc7c8dc11f23ad4a2` publicado no repositório `trekiodevs-beep/presenca-juridica`. |
| Coolify / frontend | `GET /billing` respondeu `200`; o bundle de cobrança publicado respondeu `200` e contém as opções Pix e boleto. |
| Supabase `billing-summary` | `ACTIVE`, versão 7. |
| Supabase `billing-webhook` | `ACTIVE`, versão 8. |
| Supabase `billing-create-checkout` | `ACTIVE`, versão 9. |

Projeto Supabase utilizado: `uwuhynvzalxvjvgersld` (`CRM - Trekio`). A publicação das funções foi feita de forma individual e com os arquivos compartilhados necessários. Houve um `502` transitório durante a atualização do Coolify; a consulta seguinte retornou `200` com o novo bundle.

## 4. Validação executada

- `npm run lint`: passou.
- `npm test`: 49 testes passaram.
- `npm run build`: passou.
- Chamadas sem autenticação a `billing-summary` e `billing-create-checkout`: `401`, conforme esperado.
- Chamada a `billing-webhook` sem token Asaas: `401`, conforme esperado.
- Consulta à base: quatro preços ativos, nenhuma assinatura em andamento e nenhum escritório com assinatura ativa no momento da verificação. O escritório Martins Advocacia estava em estado `TRIALING`.

Essas verificações confirmam publicação, compilação e controles básicos de acesso. **Ainda não comprovam** criação de uma cobrança real no Asaas Sandbox, pagamento, entrega de webhook nem ativação automática do plano.

## 5. Homologação ainda necessária

1. Entrar no CRM com uma conta autorizada do escritório de teste.
2. Escolher um plano e Pix; confirmar que a função cria a assinatura e apresenta cobrança/QR Code ou um estado pendente recuperável.
3. Recarregar a página e confirmar que o pagamento pendente continua disponível.
4. Concluir um pagamento de teste no Asaas Sandbox.
5. Conferir o evento nos logs de webhook do Asaas e em `billing_webhook_events` no Supabase.
6. Confirmar `billing_payments`, `billing_subscriptions` e `offices` com os estados e períodos coerentes.
7. Repetir a criação para boleto e cartão, inclusive cancelamento ou expiração do checkout de cartão.

O registro de `billing_customers` apresentado pelo usuário permite reutilizar o cliente Asaas, mas não substitui uma sessão autenticada do CRM. O ambiente do agente não tinha credenciais de uma conta de teste, e a tentativa de acessar a janela do navegador expirou. Por isso, a homologação financeira permanece **pendente**.

## 6. Riscos e pontos de acompanhamento

- As funções novas estão no projeto Supabase atual, acessível pelo CRM publicado. Erros em Pix, boleto ou na correlação de webhooks podem afetar uma contratação até que o teste ponta a ponta seja concluído.
- Pix e boleto geram cobranças por período; o pagamento das próximas parcelas depende de ação do cliente. Não há Pix Automático nesta implementação.
- O fluxo de cartão depende da entrega dos eventos e da correlação da assinatura no Asaas. Falhas devem aparecer como eventos pendentes/fracassados para reprocessamento e diagnóstico.
- A configuração do webhook foi vista como ativada no painel do Asaas durante a investigação anterior, mas a entrega de um evento real da nova jornada ainda não foi observada.
- O endpoint preserva um padrão de cartão para chamadas antigas que omitam `billingType`; a interface nova exige escolha explícita. Esse comportamento de compatibilidade deve ser revisado após a homologação.

## 7. Referências

- [Checkout com assinatura recorrente — Asaas](https://docs.asaas.com/docs/checkout-com-assinatura-recorrente)
- [Criando uma assinatura — Asaas](https://docs.asaas.com/docs/criando-uma-assinatura)
- [Cobranças via Pix — Asaas](https://docs.asaas.com/docs/cobrancas-via-pix)
- [Eventos de Checkout — Asaas](https://docs.asaas.com/docs/checkout-events)

## 8. Revisão da jornada após teste

A interface foi reorganizada para plano primeiro e etapa de pagamento depois, com resumo do total e opções em cartões. O CPF deixou de ser solicitado no CRM para cartão: o checkout hospedado coleta identificação, endereço e cartão. Pix e boleto solicitam o documento somente após a escolha do plano e método.

O Asaas havia rejeitado o checkout por endereço incompleto no customer enviado. O checkout de cartão agora é criado sem customer; no evento de pagamento, o backend busca o cliente efetivo do Asaas, salva o vínculo local e só então ativa a assinatura. A migração billing_hosted_checkout_customer permite customer_id ausente apenas em cartão PENDING ou CANCELED. Funções publicadas: billing-create-checkout v10 e billing-webhook v9. A confirmação financeira ponta a ponta continua pendente.

## 9. Confirmação e conciliação do pagamento trimestral

O teste gerou pagamento confirmado de R$ 299,70 no Sandbox, mas o evento CHECKOUT_PAID falhou porque a correlação não considerava checkoutSession dos eventos de pagamento e assinatura. Os eventos de pagamento haviam sido recebidos sem atualização local. A correção usa checkoutSession e recupera o pagamento pelos eventos persistidos; o resumo pode reprocessar CHECKOUT_PAID com falha para o escritório autenticado. Publicados billing-webhook v10 e billing-summary v8.

O incidente atual foi conciliado em uma transação SQL usando PAYMENT_CONFIRMED e CHECKOUT_PAID persistidos, validando valor e vínculos. Assinatura e escritório ficaram ACTIVE e o pagamento CONFIRMED foi registrado. Isso recupera este teste; a correção automática ainda deve ser confirmada em uma próxima contratação.
