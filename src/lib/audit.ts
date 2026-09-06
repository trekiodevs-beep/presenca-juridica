import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

export const recordLoginEvent = async () => {
  const callable = httpsCallable<Record<string, never>, { recordedAt: string }>(getFunctions(app, 'southamerica-east1'), 'recordLoginEvent');
  return (await callable({})).data;
};
