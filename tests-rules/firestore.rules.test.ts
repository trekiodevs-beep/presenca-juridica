import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let environment: RulesTestEnvironment;
const future = Date.now() + 86400000;

before(async () => {
  environment = await initializeTestEnvironment({ projectId: 'presenca-juridica-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
beforeEach(async () => environment.clearFirestore());
after(async () => environment.cleanup());

const seed = async () => environment.withSecurityRulesDisabled(async context => {
  const database = context.firestore();
  await Promise.all([
    setDoc(doc(database, 'users/u1'), { id: 'u1', officeId: 'o1', role: 'lawyer' }),
    setDoc(doc(database, 'users/u2'), { id: 'u2', officeId: 'o2', role: 'lawyer' }),
    setDoc(doc(database, 'offices/o1'), { id: 'o1', subscriptionStatus: 'ACTIVE' }),
    setDoc(doc(database, 'offices/o2'), { id: 'o2', subscriptionStatus: 'ACTIVE' }),
    setDoc(doc(database, 'memberships/o1_u1'), { id: 'o1_u1', officeId: 'o1', userId: 'u1', role: 'lawyer', status: 'active' }),
    setDoc(doc(database, 'memberships/o2_u2'), { id: 'o2_u2', officeId: 'o2', userId: 'u2', role: 'lawyer', status: 'active' }),
    setDoc(doc(database, 'leads/l1'), { id: 'l1', officeId: 'o1', name: 'Cliente', createdAt: '2026-01-01', updatedAt: '2026-01-01' }),
    setDoc(doc(database, 'leads/l2'), { id: 'l2', officeId: 'o2', name: 'Outro', createdAt: '2026-01-01', updatedAt: '2026-01-01' }),
  ]);
});

test('um usuário lê apenas o próprio tenant', async () => {
  await seed();
  const database = environment.authenticatedContext('u1').firestore();
  await assertSucceeds(getDoc(doc(database, 'leads/l1')));
  await assertFails(getDoc(doc(database, 'leads/l2')));
});

test('criação direta de contato é negada para forçar limite transacional', async () => {
  await seed();
  const database = environment.authenticatedContext('u1').firestore();
  await assertFails(setDoc(doc(database, 'leads/new'), { id: 'new', officeId: 'o1', name: 'Novo', createdAt: '2026-01-01', updatedAt: '2026-01-01' }));
});

test('membro bloqueado não acessa o tenant', async () => {
  await seed();
  await environment.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'memberships/o1_u1'), { status: 'blocked' }));
  await assertFails(getDoc(doc(environment.authenticatedContext('u1').firestore(), 'leads/l1')));
});

test('assinatura ativa permite atualização e trial expirado bloqueia', async () => {
  await seed();
  const lead = doc(environment.authenticatedContext('u1').firestore(), 'leads/l1');
  await assertSucceeds(updateDoc(lead, { name: 'Atualizado', updatedAt: '2026-01-02' }));
  await environment.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'offices/o1'), { subscriptionStatus: 'TRIALING', trialEndsAtMs: future - 2 * 86400000 }));
  await assertFails(updateDoc(lead, { name: 'Negado', updatedAt: '2026-01-03' }));
  let persistedName: unknown;
  await environment.withSecurityRulesDisabled(async context => { persistedName = (await getDoc(doc(context.firestore(), 'leads/l1'))).data()?.name; });
  assert.equal(persistedName, 'Atualizado');
});
