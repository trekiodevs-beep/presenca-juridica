import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

export const completeOnboarding = async () => {
  const callable = httpsCallable<Record<string, never>, { completedAt: string }>(getFunctions(app, 'southamerica-east1'), 'completeOnboarding');
  return (await callable({})).data;
};
