import assert from 'node:assert/strict';
import test from 'node:test';
import { getAccessMode, getGraceDaysRemaining } from '../src/lib/access';
import { createTrialWindow, getTrialState } from '../src/lib/trial';
import { getPlanLimits, hasPermission } from '../src/lib/plans';
import type { Office } from '../src/types';

const office = (partial: Partial<Office>): Office => ({ id: 'office-1', name: 'Escritório', lawyerName: 'Nome', oab: 'OAB', city: 'Cidade', state: 'MG', whatsapp: '5535999999999', email: 'contato@example.com', areas: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...partial });

test('trial tem exatamente 15 dias e limite comercial esperado', () => {
  const now = new Date('2026-09-06T12:00:00.000Z');
  const trial = createTrialWindow(now);
  assert.equal(trial.trialEndsAtMs - now.getTime(), 15 * 24 * 60 * 60 * 1000);
  assert.deepEqual(getPlanLimits('trial'), { maxUsers: 2, maxContacts: 100, maxStorageBytes: 512 * 1024 * 1024 });
});

test('trial e tolerância sem prazo numérico não liberam escrita', () => {
  const now = Date.parse('2026-09-06T12:00:00.000Z');
  assert.equal(getAccessMode(office({ subscriptionStatus: 'TRIALING', trialEndsAt: null, trialEndsAtMs: null }), now), 'read_only');
  assert.equal(getAccessMode(office({ subscriptionStatus: 'PAST_DUE', graceEndsAtMs: null }), now), 'read_only');
  assert.equal(getAccessMode(office({ subscriptionStatus: 'GRACE_PERIOD', graceEndsAtMs: now + 2 * 86400000 }), now), 'grace');
  assert.equal(getGraceDaysRemaining(office({ graceEndsAtMs: now + 25 * 60 * 60 * 1000 }), now), 2);
});

test('trial expirado e ativo são distinguidos deterministicamente', () => {
  const now = new Date('2026-09-06T12:00:00.000Z');
  assert.equal(getTrialState(office({ subscriptionStatus: 'TRIALING', trialEndsAt: '2026-09-07T12:00:00.000Z' }), now)?.kind, 'trialing');
  assert.equal(getTrialState(office({ subscriptionStatus: 'TRIALING', trialEndsAt: '2026-09-05T12:00:00.000Z' }), now)?.kind, 'expired');
  assert.equal(getAccessMode(office({ subscriptionStatus: 'ACTIVE' }), now.getTime()), 'full');
});

test('perfis respeitam menor privilégio', () => {
  assert.equal(hasPermission('owner', 'billing.manage'), true);
  assert.equal(hasPermission('admin', 'billing.manage'), false);
  assert.equal(hasPermission('assistant', 'finance.write'), false);
  assert.equal(hasPermission('finance', 'documents.write'), false);
  assert.equal(hasPermission('read', 'contacts.write'), false);
});
