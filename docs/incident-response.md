# Resposta a incidentes

## Severidade

- **SEV-1:** vazamento confirmado, indisponibilidade total ou corrupção ampla.
- **SEV-2:** degradação relevante, falha de cobrança em massa ou isolamento suspeito sem confirmação.
- **SEV-3:** falha localizada com alternativa operacional.

## Procedimento

1. Registrar horário, impacto, evidências e responsável pelo comando do incidente.
2. Conter: revogar credenciais/segredos afetados, bloquear acesso comprometido e pausar alterações não essenciais.
3. Preservar `auditLogs`, `billingEvents`, logs das Functions e versões do Cloud Storage; não editar evidência original.
4. Identificar causa raiz e universo de titulares/escritórios afetados.
5. Recuperar pelo último estado íntegro, validar contagens e executar testes de isolamento.
6. Comunicar clientes e autoridades nos prazos legais aplicáveis, com revisão jurídica/DPO.
7. Publicar relatório pós-incidente com ações corretivas, responsável e prazo.

Nunca declarar resolução com base apenas em build ou healthcheck. Exigir prova da jornada afetada no ambiente real.
