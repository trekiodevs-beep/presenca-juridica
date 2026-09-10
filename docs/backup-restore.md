# Backup e restauração

## Estado atual

O fluxo de backup/restore Supabase ainda é um gate operacional pendente. Não tratar migrations, exportação manual ou build como backup validado.

## Preparação obrigatória

1. Definir política de retenção do Postgres e Storage.
2. Habilitar backups do projeto Supabase.
3. Registrar o procedimento de exportação e restauração em projeto separado.
4. Validar restore com contagens, RLS, arquivos e integridade referencial.
5. Registrar data, projeto, operador e evidências do ensaio.

## Go/no-go

Não liberar produção sem um restore real testado fora do projeto principal. O modo mock e os dados demonstrativos não fazem parte do backup.
