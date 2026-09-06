# Backup e restauração

## Política implementada

- `backupTenantData` percorre até cinco escritórios a cada cinco minutos e mantém um cursor em `_system/backupCursor`.
- Cada arquivo `backups/{officeId}/{AAAA-MM-DD}.json.gz` contém manifesto, banco de origem, documentos e SHA-256 do conteúdo sem compressão.
- Ao concluir um ciclo, arquivos com mais de 30 dias são eliminados.
- O backup inclui dados operacionais, cobrança, auditoria, privacidade e suporte. Usuários do Firebase Authentication não são recriados pelo arquivo.

## Restauração controlada

1. Baixe o objeto correto do bucket para uma estação administrativa isolada.
2. Configure Application Default Credentials com acesso ao projeto e `FIRESTORE_DATABASE_ID` quando o backup não indicar o banco correto.
3. Confira o `officeId` do manifesto.
4. Execute:

```powershell
npm --prefix functions run restore:backup -- C:\backup\office.json.gz --confirm-office=OFFICE_ID
```

O script usa `set(..., merge=true)` em lotes de 400 e não apaga dados que não estejam no arquivo. Faça o ensaio primeiro em projeto separado, valide contagens e integridade dos anexos e só depois autorize uma recuperação real.

## Limites conhecidos

O backup versiona metadados do documento; os binários permanecem no Cloud Storage e dependem da política de versionamento/retencão do bucket. Para clientes `custom` com volume excepcional, use exportação gerenciada do Firestore e replicação/versionamento do bucket como política contratual específica.
