export const getStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    'Novo contato': 'Novo contato',
    'Aguardando triagem': 'Aguardando triagem inicial',
    'Triagem realizada': 'Triagem realizada',
    'Aguardando informações': 'Aguardando informações',
    'Consulta agendada': 'Consulta agendada',
    'Proposta enviada': 'Proposta de honorários enviada',
    'Contratado': 'Atendimento contratado',
    'Não avançou': 'Não avançou',
    'Arquivado': 'Arquivado'
  };
  return map[status] || status;
};

export const getEventActionLabel = (type: string): string => {
  const map: Record<string, string> = {
    'lead_created': 'Contato criado',
    'whatsapp_opened': 'WhatsApp aberto',
    'note_added': 'Anotação registrada',
    'status_changed': 'Situação atualizada',
    'task_created': 'Providência criada',
    'task_completed': 'Providência concluída',
    'contact_updated': 'Contato atualizado',
    'system_event': 'Evento do sistema'
  };
  return map[type] || type;
};
