# Fluxo E2E manual — Presença Jurídica CRM

## Objetivo

Validar manualmente a jornada principal de um escritório: entrar no sistema, configurar o espaço, cadastrar um contato, fazer a triagem, criar providência, tarefa, compromisso, lançamento financeiro, publicar uma atualização no portal e retornar ao contato pelo WhatsApp.

Este roteiro comprova o comportamento observado no ambiente testado. Não comprova, por si só, deploy, migrations remotas, RLS em produção, envio de e-mail/WhatsApp, OAuth Google ou operação em produção.

## Dados controlados

Use dados fictícios, nunca dados reais de clientes.

| Campo | Valor sugerido |
| --- | --- |
| Nome | Ana Paula de Homologação |
| WhatsApp | número de teste com DDI e DDD válidos |
| E-mail | ana.homologacao+AAAAMMDD@example.com |
| Área | Trabalhista |
| Origem | WhatsApp |
| Situação inicial | Novo contato |
| Próxima providência | Confirmar documentos iniciais |
| Data da providência | amanhã |
| Tarefa | Conferir documentos de Ana Paula |
| Prazo da tarefa | amanhã |
| Compromisso | Reunião de homologação — Ana Paula |
| Duração | 30 minutos, em data futura |
| Lançamento | R$ 350,00, consulta, pendente |

## Pré-condições e evidências

1. Defina o ambiente: URL publicada de homologação ou execução local. Registre URL, data/hora, navegador e resolução.
2. Confirme que `VITE_USE_MOCK_DATA=false` quando a intenção for validar Supabase. Se estiver em modo demonstrativo, marque o resultado como **DEMO**, não como validação de produção.
3. Use uma conta de teste autorizada. Tenha uma segunda aba/perfil anônimo para o formulário público e outra conta Google somente se o gate Google for executado.
4. Abra o DevTools apenas para registrar erros de Console e falhas de rede; não exponha tokens, cookies ou chaves.
5. Para cada etapa, registre: PASSOU, FALHOU ou NÃO COMPROVADO, com captura de tela e observação objetiva.

## Fluxo principal

### 1. Login, aceite e onboarding

1. Abra `/login`.
2. Entre com a conta de teste pelo Google.
3. Na primeira entrada, aceite a versão legal apresentada.
4. Se não houver escritório, abra as configurações, preencha nome do escritório, responsável, WhatsApp e dados públicos; salve.
5. Abra **Primeiros passos** (`/onboarding`).
6. Execute os três marcos exibidos, incluindo **Criar exemplo** quando essa opção estiver disponível.
7. Atualize a página, saia e entre novamente.

Resultado esperado: a sessão permanece válida após refresh/login; o escritório correto é carregado; os marcos concluídos continuam concluídos; equipe, portal e Google não bloqueiam a conclusão do onboarding.

### 2. Cadastrar o contato

1. Abra **Novo contato** (`/leads/new`).
2. Preencha os dados controlados acima e salve uma única vez.
3. Durante o envio, tente clicar novamente no botão de salvar.
4. Confirme a mensagem de sucesso e abra **Ver contato**.
5. Volte para **Contatos** e pesquise pelo nome.
6. Navegue para **Hoje** e retorne ao dossiê.

Resultado esperado: há exatamente um contato; os dados permanecem após navegação; o CTA de sucesso leva ao dossiê; não há duplicidade por duplo clique; o contato aparece nos contextos correspondentes.

### 3. Triagem e próxima providência

1. No dossiê, altere a situação para **Triagem realizada**.
2. Verifique o card, o cabeçalho/dossiê e a timeline.
3. Preencha a próxima providência, a data de amanhã e salve.
4. Atualize a página e abra o contato novamente.

Resultado esperado: a situação e a providência aparecem sem estado divergente; a timeline registra as alterações; a providência continua visível após refresh.

### 4. Criar e concluir uma tarefa

1. Abra **Tarefas** (`/tarefas`) e clique em **Criar**.
2. Informe o título, selecione o contato Ana Paula e defina o prazo de amanhã.
3. Salve; tente repetir o clique enquanto o botão estiver salvando.
4. Confirme que a tarefa aparece vinculada ao contato.
5. Navegue para outra tela e volte para **Tarefas**.
6. Conclua a tarefa e depois use o mesmo controle para reabri-la.

Resultado esperado: uma única tarefa é criada, o vínculo ao contato é preservado, o formulário fecha após sucesso e concluir/reabrir altera o estado corretamente.

### 5. Criar e localizar o compromisso na agenda local

1. No dossiê, em **Agenda deste contato**, crie o compromisso controlado para uma data futura.
2. Confirme o salvamento e verifique a lista do próprio dossiê.
3. Abra **Agenda** (`/agenda`) e selecione o dia do compromisso.
4. Edite o título ou local e salve.
5. Verifique a atualização no dossiê e na Agenda.
6. Se o roteiro exigir limpeza, exclua o evento pelo diálogo de confirmação e confirme que ele não aparece mais.

Resultado esperado: o compromisso aparece uma vez nos dois contextos, mantém o `lead` correto, pode ser editado e a exclusão exige confirmação. Falha do Google, se houver, não pode apagar o compromisso local.

### 6. Registrar o financeiro

1. No dossiê, em **Financeiro deste contato**, crie o lançamento de R$ 350,00.
2. Use tipo consulta, vencimento futuro e situação pendente.
3. Abra **Financeiro** (`/financeiro`) e localize o lançamento pelo contato/valor.
4. Atualize a página e confirme novamente.

Resultado esperado: valor, tipo, vencimento, situação e contato são iguais no dossiê e no Financeiro; não há lançamento duplicado.

### 7. Publicar no portal do cliente

1. No dossiê, abra **Portal do cliente**.
2. Publique somente o status e o compromisso necessários para o teste; não publique notas internas ou dados financeiros não autorizados.
3. Salve e gere o link.
4. Abra o link em aba anônima/perfil separado.
5. Confirme que o portal pertence à Ana Paula e mostra somente os dados publicados.
6. Altere o status público, salve e recarregue a aba anônima.

Resultado esperado: o link abre, identifica o contato correto, reflete a atualização e não revela notas internas, dados de outros contatos ou conteúdo não publicado. Se o portal real não estiver disponível, marque **NÃO COMPROVADO**.

### 8. Retorno pelo WhatsApp

1. No dossiê, clique em **Retornar pelo WhatsApp**.
2. Confirme que o aplicativo/aba externa abre com contato e mensagem preenchidos.
3. Revise o texto; não envie a mensagem sem autorização operacional explícita.
4. Retorne ao CRM e confirme o registro de abertura na timeline, quando disponível.

Resultado esperado: o CRM prepara a conversa e deixa o envio sob controle humano. Nunca registrar “mensagem enviada” apenas porque o link foi aberto.

### 9. Rotina em Hoje e logout

1. Abra **Hoje** (`/`).
2. Confirme que a providência e eventuais pendências aparecem.
3. Abra o contato a partir de Hoje e valide a continuidade do fluxo.
4. Faça logout.
5. Tente abrir diretamente uma rota autenticada, como `/leads`.

Resultado esperado: Hoje aponta para o contato correto; o logout encerra a sessão; rota autenticada redireciona para login; nenhuma informação privada fica acessível sem sessão.

## Gates opcionais

### Formulário público → lead

1. Abra o link em aba anônima (`/public/:officeSlug/contact`).
2. Envie um segundo contato fictício com consentimento válido.
3. Clique em enviar repetidamente enquanto aguarda.
4. Confirme a mensagem de sucesso e, na sessão autenticada, localize o novo contato.
5. Tente enviar com consentimento inválido e confirme o erro sem perder os dados digitados.

Esperado: o formulário público lê somente a configuração permitida, cria o lead no escritório correto, não permite insert direto indevido e não promete envio automático de WhatsApp.

### Google Calendar

Executar somente com OAuth, secrets, Functions e scheduler de homologação comprovadamente configurados.

1. Em Configurações, conecte uma conta Google de teste.
2. Selecione explicitamente uma agenda.
3. Crie um compromisso no CRM e confirme um único evento no Google.
4. Edite o evento nos dois sentidos.
5. Crie um evento diretamente no Google e confirme a reconciliação local sem criação automática de lead.
6. Exclua o evento no Google e confirme o estado local esperado.
7. Teste reconexão, token revogado, retry e conflito, usando a opção de revisão manual.

Se qualquer dependência externa não estiver disponível, o resultado é **NÃO COMPROVADO**, mesmo que a tela de conexão exista.

## Critérios de aprovação

- PASSA: comportamento esperado observado, persistência confirmada e evidência anexada.
- FALHA: comportamento incorreto, erro não recuperável, duplicidade, vazamento ou tenant incorreto. Interromper a divulgação.
- NÃO COMPROVADO: etapa não executada, ambiente mock, dependência externa ausente ou evidência insuficiente.

O E2E só pode ser considerado aprovado quando todas as etapas obrigatórias passarem e não houver P0/P1: perda/vazamento de dados, contato ou evento em escritório errado, duplicidade, sessão quebrada, portal indevido ou mutação sem autorização.

## Registro da execução

| Etapa | Resultado | Evidência/observação |
| --- | --- | --- |
| Login, aceite e onboarding |  |  |
| Cadastro do contato |  |  |
| Triagem e providência |  |  |
| Tarefa |  |  |
| Agenda local |  |  |
| Financeiro |  |  |
| Portal |  |  |
| WhatsApp |  |  |
| Hoje e logout |  |  |
| Formulário público (opcional) |  |  |
| Google Calendar (opcional) |  |  |
