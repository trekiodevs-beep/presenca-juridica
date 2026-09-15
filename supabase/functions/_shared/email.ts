const RESEND_API_URL = 'https://api.resend.com/emails';

export interface TransactionalEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
};

export const sendTransactionalEmail = async (input: TransactionalEmailInput) => {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const from = requiredEnv('EMAIL_FROM');
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const providerMessage = await response.text();
    throw new Error(`Resend ${response.status}: ${providerMessage.slice(0, 500)}`);
  }

  return await response.json() as { id?: string };
};
