import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app, 'southamerica-east1');

export const submitPrivacyRequest = async (input: { email: string; requestType: string; details: string }) => {
  const callable = httpsCallable<typeof input, { protocol: string }>(functions, 'submitPrivacyRequest');
  return (await callable(input)).data;
};

export const submitSupportTicket = async (input: { subject: string; message: string }) => {
  const callable = httpsCallable<typeof input, { ticketId: string }>(functions, 'submitSupportTicket');
  return (await callable(input)).data;
};
