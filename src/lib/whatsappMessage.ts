import type { Lead, Office } from '../types';

export const DEFAULT_WHATSAPP_MESSAGE = `Olá, [Nome]. Tudo bem?

Recebemos sua solicitação [Origem] sobre uma dúvida na área de [Área].

Para organizar melhor o atendimento inicial, gostaria de confirmar algumas informações antes de encaminhar para análise da pessoa responsável.

Você poderia me informar brevemente o contexto da sua dúvida?`;

export const getWhatsappMessageTemplate = (office?: Office | null) =>
  office?.whatsappMessageTemplate?.trim() || DEFAULT_WHATSAPP_MESSAGE;

export const buildWhatsappMessage = (office: Office | null | undefined, lead: Lead) =>
  getWhatsappMessageTemplate(office)
    .replace(/\[Nome\]/gi, lead.name.split(' ')[0] || lead.name)
    .replace(/\[Origem\]/gi, String(lead.source))
    .replace(/\[Área\]/gi, String(lead.area));
