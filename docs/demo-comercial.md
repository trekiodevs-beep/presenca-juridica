# Demonstração comercial — jornada pública até o atendimento

O modo `VITE_USE_MOCK_DATA=true` oferece o escritório fictício `silva-advogados-demo` e 15 contatos iniciais. Os links de Canais de entrada usam esse slug.

## Jornada preparada

1. Abrir o link de formulário exibido em Canais de entrada.
2. Preencher os dados fictícios e o consentimento; enviar.
3. Abrir Contatos: a solicitação aparece como Novo contato, com evento inicial.
4. Abrir o dossiê, atualizar a situação, definir a próxima providência e registrar uma observação.
5. Recarregar a página para conferir a persistência da demonstração.

O modo demonstrativo usa exclusivamente o armazenamento local do navegador (`presenca-juridica-demo-v1`) para esses dados. A mesma origem e o mesmo perfil de navegador são necessários para compartilhar o estado. Não há transmissão do formulário demonstrativo ao Firebase. O armazenamento não representa autenticação ou isolamento multi-tenant e não deve receber dados reais. Para reiniciar a demonstração, remova somente essa chave no armazenamento do navegador ou use um perfil novo.

`src/lib/demoStore.ts` implementa a base fictícia, a persistência e o evento de atualização do formulário. `DataContext` carrega e mantém esse estado no modo mock. O comportamento Firebase existente continua selecionado quando o modo mock está desativado.

## Vídeo

Peça com abertura e encerramento tipográficos inspirados no site https://www.trekio-tecnologia.com.br/, telas reais do frontend, legendas incorporadas e aviso de ambiente demonstrativo. O clique inicial representa o acesso ao link compartilhado pelo escritório; a passagem ao CRM representa a troca de perspectiva para a equipe. Não demonstra login, envio de WhatsApp, cobrança real ou infraestrutura Firebase homologada.

Verificação realizada pelo navegador: envio público, presença do mesmo contato no funil, alteração da triagem, próxima ação, observação e persistência após recarregar. A gravação não constitui prova do backend de produção.
