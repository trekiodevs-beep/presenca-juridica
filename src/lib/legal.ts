import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

export const LEGAL_VERSION = '2026-09-06-v1';

export const acceptLegalTerms = async () => {
  const callable = httpsCallable<{ accepted: boolean; version: string }, { version: string; acceptedAt: string }>(getFunctions(app, 'southamerica-east1'), 'acceptLegalTerms');
  return (await callable({ accepted: true, version: LEGAL_VERSION })).data;
};
