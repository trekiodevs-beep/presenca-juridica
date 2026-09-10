# Operação da Central de Atenção

## Avaliação manual ou agendada

### Smoke local

Em um terminal, mantenha o runtime ativo e aguarde a linha `Serving functions` antes de chamar o smoke test:

```powershell
Copy-Item supabase/functions/.env.example supabase/functions/.env.local
# edite .env.local e substitua os placeholders
npx supabase functions serve alarm-evaluator --no-verify-jwt --env-file supabase/functions/.env.local --debug
```

Em outro terminal:

```powershell
$env:ALARM_EVALUATOR_SECRET = 'segredo-local'
npm run smoke:alarm-evaluator
```

Se o smoke for executado enquanto o runtime ainda está inicializando, o gateway local pode responder `404 Function not found`. Isso é uma condição de corrida de inicialização; a confirmação correta é a linha de rota do `--debug` seguida de uma nova chamada.

A Edge Function `alarm-evaluator` executa as regras persistentes usando `service_role`. Ela não deve ser chamada pelo navegador.

Variáveis obrigatórias no ambiente da função:

- `SUPABASE_URL`;
- `BACKEND_SERVICE_ROLE_KEY` (ou equivalente suportado pela função);
- `ALARM_EVALUATOR_SECRET`.

Invocação de um escritório:

```powershell
$env:ALARM_EVALUATOR_SECRET = '<segredo-fora-do-repositorio>'
$env:ALARM_EVALUATOR_OFFICE_ID = '<office-id>'
npm run smoke:alarm-evaluator
```

Sem `ALARM_EVALUATOR_OFFICE_ID`, o worker avalia todos os escritórios. O scheduler deve enviar `POST` para a URL da função e o header `x-alarm-evaluator-secret`. Recomenda-se intervalo de cinco minutos e timeout menor que o intervalo, com alerta operacional quando a resposta for `207` ou `5xx`.

## Gate de produção

Antes de habilitar o scheduler:

1. aplicar e verificar as migrações no projeto Supabase correto;
2. cadastrar o segredo no ambiente da função;
3. testar primeiro com `office_id` de homologação;
4. confirmar criação, destinatários, Realtime e resolução automática;
5. habilitar todos os escritórios e observar duplicação, latência e falhas.

O frontend continua lendo apenas alarmes materializados para o usuário autenticado. Nenhuma chave `service_role` deve aparecer em `VITE_*`, no bundle ou no navegador.
