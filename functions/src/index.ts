import { createHash, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { getApp, initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';

initializeApp();

const asaasApiKey = defineSecret('ASAAS_API_KEY');
const asaasWebhookToken = defineSecret('ASAAS_WEBHOOK_TOKEN');
const resendApiKey = defineSecret('RESEND_API_KEY');
const appUrl = defineString('APP_URL', { default: 'http://localhost:3000' });
const asaasBaseUrl = defineString('ASAAS_BASE_URL', { default: 'https://api.asaas.com/v3' });
const emailFrom = defineString('EMAIL_FROM', { default: 'Presença Jurídica <noreply@trekio.com.br>' });
const databaseId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-crmpresenajurdic-84f41a05-98d7-43ba-a467-164579af084d';
const db = getFirestore(getApp(), databaseId);
const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_VALUES: Record<string, number> = { essential: 149, professional: 249 };
const PLAN_LIMITS: Record<string, { maxUsers: number; maxContacts: number; maxStorageBytes: number }> = {
  trial: { maxUsers: 2, maxContacts: 100, maxStorageBytes: 512 * 1024 * 1024 },
  essential: { maxUsers: 3, maxContacts: 500, maxStorageBytes: 5 * 1024 * 1024 * 1024 },
  professional: { maxUsers: 10, maxContacts: 2000, maxStorageBytes: 20 * 1024 * 1024 * 1024 },
  custom: { maxUsers: 1000, maxContacts: 1000000, maxStorageBytes: 1024 * 1024 * 1024 * 1024 },
};

type CallableContext = { auth?: { uid: string; token: Record<string, unknown> } };

const requireAuth = (request: CallableContext) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Autenticação obrigatória.');
  return request.auth.uid;
};

const getUser = async (uid: string) => {
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) throw new HttpsError('permission-denied', 'Perfil de usuário não encontrado.');
  return snapshot.data() as { officeId?: string; role?: string; globalRole?: string; email?: string; name?: string };
};

const requireOfficeManager = async (uid: string) => {
  const user = await getUser(uid);
  if (!user.officeId || !['owner', 'admin'].includes(user.role || '')) throw new HttpsError('permission-denied', 'Somente proprietário ou administrador.');
  const membership = await db.doc(`memberships/${user.officeId}_${uid}`).get();
  if (membership.exists && membership.data()?.status !== 'active') throw new HttpsError('permission-denied', 'Acesso de membro bloqueado.');
  const office = await db.doc(`offices/${user.officeId}`).get();
  if (!office.exists) throw new HttpsError('failed-precondition', 'Escritório não encontrado.');
  return { user, officeId: user.officeId, office: office.data() as Record<string, unknown> };
};

const officeAllowsWrites = (office: Record<string, unknown>) => {
  const status = String(office.subscriptionStatus || '');
  if (status === 'ACTIVE') return true;
  if (status === 'TRIALING') return Number(office.trialEndsAtMs || 0) > Date.now();
  if (['PAST_DUE', 'GRACE_PERIOD'].includes(status)) return Number(office.graceEndsAtMs || 0) > Date.now();
  return false;
};

const requireOfficeOperator = async (uid: string) => {
  const user = await getUser(uid);
  if (!user.officeId || !['owner', 'admin', 'lawyer', 'assistant'].includes(user.role || '')) throw new HttpsError('permission-denied', 'Perfil sem permissão operacional.');
  const membership = await db.doc(`memberships/${user.officeId}_${uid}`).get();
  if (membership.exists && membership.data()?.status !== 'active') throw new HttpsError('permission-denied', 'Acesso de membro bloqueado.');
  const officeSnapshot = await db.doc(`offices/${user.officeId}`).get();
  if (!officeSnapshot.exists) throw new HttpsError('failed-precondition', 'Escritório não encontrado.');
  const office = officeSnapshot.data() as Record<string, unknown>;
  if (!officeAllowsWrites(office)) throw new HttpsError('failed-precondition', 'Assinatura sem permissão de escrita.');
  return { user, officeId: user.officeId, office };
};

const limitsForOffice = (office: Record<string, unknown>) => {
  const planCode = String(office.planCode || 'trial');
  const configured = office.limits as Partial<{ maxUsers: number; maxContacts: number; maxStorageBytes: number }> | undefined;
  const fallback = PLAN_LIMITS[planCode] || PLAN_LIMITS.trial;
  return {
    maxUsers: Number(configured?.maxUsers || fallback.maxUsers),
    maxContacts: Number(configured?.maxContacts || fallback.maxContacts),
    maxStorageBytes: Number(configured?.maxStorageBytes || fallback.maxStorageBytes),
  };
};

const ensureUsageCounter = async (officeId: string) => {
  const counterRef = db.doc(`usageCounters/${officeId}`);
  if ((await counterRef.get()).exists) return counterRef;
  const [users, invitations, contacts, documents] = await Promise.all([
    db.collection('memberships').where('officeId', '==', officeId).where('status', '==', 'active').count().get(),
    db.collection('invitations').where('officeId', '==', officeId).where('status', '==', 'pending').count().get(),
    db.collection('leads').where('officeId', '==', officeId).count().get(),
    db.collection('leadDocuments').where('officeId', '==', officeId).get(),
  ]);
  const storageBytes = documents.docs.reduce((total, item) => total + Number(item.data().size || 0), 0);
  await db.runTransaction(async transaction => {
    if ((await transaction.get(counterRef)).exists) return;
    transaction.create(counterRef, { officeId, users: users.data().count + invitations.data().count, contacts: contacts.data().count, storageBytes, storageReservedBytes: 0, refreshedAt: new Date().toISOString() });
  });
  return counterRef;
};

const requiredText = (value: unknown, field: string, min: number, max: number) => {
  const normalized = String(value || '').trim();
  if (normalized.length < min || normalized.length > max) throw new HttpsError('invalid-argument', `${field} deve ter entre ${min} e ${max} caracteres.`);
  return normalized;
};

const optionalText = (value: unknown, max: number) => {
  const normalized = String(value || '').trim();
  if (normalized.length > max) throw new HttpsError('invalid-argument', `Campo excede ${max} caracteres.`);
  return normalized;
};

const requirePlatformAdmin = async (uid: string) => {
  const user = await getUser(uid);
  if (user.globalRole !== 'platform_admin') throw new HttpsError('permission-denied', 'Acesso administrativo global obrigatório.');
  return user;
};

const audit = async (officeId: string, uid: string, action: string, targetType: string, targetId?: string, metadata?: Record<string, string | number | boolean | null>) => {
  await db.collection('auditLogs').add({ officeId, actorUserId: uid, action, targetType, targetId: targetId || null, metadata: metadata || {}, createdAt: new Date().toISOString() });
};

const recordIntegrationError = async (provider: string, operation: string, error: unknown, officeId?: string) => {
  const errorRef = db.collection('integrationErrors').doc();
  await errorRef.set({ id: errorRef.id, officeId: officeId || null, provider, operation, error: String(error).slice(0, 1500), status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
};

const asaasRequest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${asaasBaseUrl.value().replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { access_token: asaasApiKey.value(), 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Asaas ${response.status}: ${JSON.stringify(body)}`);
    await recordIntegrationError('asaas', `${init.method || 'GET'} ${path}`.slice(0, 300), error);
    throw error;
  }
  return body as Record<string, any>;
};

const createLeadWithLimit = async (officeId: string, office: Record<string, unknown>, input: Record<string, unknown>, actorUserId: string, isPublic: boolean) => {
  const counterRef = await ensureUsageCounter(officeId);
  const leadRef = db.collection('leads').doc();
  const eventRef = db.collection('leadEvents').doc();
  const now = new Date().toISOString();
  const phone = String(input.phone || '').replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) throw new HttpsError('invalid-argument', 'Telefone inválido.');
  const email = optionalText(input.email, 254).toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido.');
  const state = requiredText(input.state, 'Estado', 2, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new HttpsError('invalid-argument', 'UF inválida.');
  const lead = {
    id: leadRef.id,
    officeId,
    name: requiredText(input.name, 'Nome', 2, 120),
    phone,
    email,
    city: requiredText(input.city, 'Cidade', 2, 120),
    state,
    source: requiredText(input.source, 'Origem', 2, 80),
    area: requiredText(input.area, 'Área jurídica', 2, 100),
    status: isPublic ? 'Novo contato' : requiredText(input.status, 'Status', 2, 80),
    priority: isPublic ? 'Média' : requiredText(input.priority, 'Prioridade', 4, 10),
    responsibleUserId: isPublic ? null : (optionalText(input.responsibleUserId, 128) || null),
    summary: requiredText(input.summary, 'Resumo', 10, 2000),
    notes: isPublic ? '' : optionalText(input.notes, 10000),
    consentLgpd: input.consentLgpd === true,
    createdVia: isPublic ? 'public_form' : (optionalText(input.createdVia, 80) || 'internal'),
    ...(isPublic ? {
      publicFormSlug: requiredText(input.publicFormSlug, 'Formulário', 2, 120),
      ...(input.utmSource ? { utmSource: optionalText(input.utmSource, 200) } : {}),
      ...(input.utmMedium ? { utmMedium: optionalText(input.utmMedium, 200) } : {}),
      ...(input.utmCampaign ? { utmCampaign: optionalText(input.utmCampaign, 200) } : {}),
    } : {}),
    createdAt: now,
    updatedAt: now,
  };
  if (isPublic && !lead.consentLgpd) throw new HttpsError('invalid-argument', 'O consentimento de privacidade é obrigatório.');
  await db.runTransaction(async transaction => {
    const counterSnapshot = await transaction.get(counterRef);
    const contacts = Number(counterSnapshot.data()?.contacts || 0);
    if (contacts >= limitsForOffice(office).maxContacts) throw new HttpsError('resource-exhausted', 'Limite de contatos do plano atingido.');
    transaction.create(leadRef, lead);
    transaction.create(eventRef, { id: eventRef.id, officeId, leadId: leadRef.id, type: 'created', description: isPublic ? 'Contato criado a partir do formulário público' : 'Contato criado no sistema', createdBy: actorUserId, createdAt: now });
    transaction.set(counterRef, { contacts: contacts + 1, refreshedAt: now }, { merge: true });
  });
  return leadRef.id;
};

export const createInternalLead = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId, office } = await requireOfficeOperator(uid);
  const leadId = await createLeadWithLimit(officeId, office, (request.data || {}) as Record<string, unknown>, uid, false);
  await audit(officeId, uid, 'contacts.created', 'lead', leadId);
  return { leadId };
});

export const createPublicLead = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const input = (request.data || {}) as Record<string, unknown>;
  const slug = requiredText(input.publicFormSlug, 'Formulário', 2, 120);
  const formSnapshot = await db.doc(`publicForms/${slug}`).get();
  if (!formSnapshot.exists || formSnapshot.data()?.isActive !== true) throw new HttpsError('not-found', 'Formulário indisponível.');
  const officeId = String(formSnapshot.data()?.officeId || '');
  const officeSnapshot = await db.doc(`offices/${officeId}`).get();
  if (!officeSnapshot.exists) throw new HttpsError('not-found', 'Escritório não encontrado.');
  const office = officeSnapshot.data() as Record<string, unknown>;
  if (!officeAllowsWrites(office)) throw new HttpsError('failed-precondition', 'Este formulário está temporariamente indisponível.');
  const leadId = await createLeadWithLimit(officeId, office, input, 'public_form', true);
  return { leadId };
});

export const completeOnboarding = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId, office } = await requireOfficeOperator(uid);
  if (office.onboardingCompletedAt) return { completedAt: office.onboardingCompletedAt };
  const [forms, leads, whatsappEvents, team, invitations, tasks, calendar, portal] = await Promise.all([
    db.collection('publicForms').where('officeId', '==', officeId).where('isActive', '==', true).limit(1).get(),
    db.collection('leads').where('officeId', '==', officeId).limit(1).get(),
    db.collection('leadEvents').where('officeId', '==', officeId).where('type', '==', 'whatsapp_opened').limit(1).get(),
    db.collection('memberships').where('officeId', '==', officeId).where('status', 'in', ['active', 'blocked']).limit(2).get(),
    db.collection('invitations').where('officeId', '==', officeId).where('status', '==', 'pending').limit(1).get(),
    db.collection('tasks').where('officeId', '==', officeId).limit(1).get(),
    db.collection('calendarEvents').where('officeId', '==', officeId).limit(1).get(),
    db.collection('clientPortalAccess').where('officeId', '==', officeId).limit(1).get(),
  ]);
  if (forms.empty || leads.empty || whatsappEvents.empty || (team.size < 2 && invitations.empty) || tasks.empty || calendar.empty || portal.empty) throw new HttpsError('failed-precondition', 'Conclua todas as etapas do onboarding antes de finalizar.');
  const completedAt = new Date().toISOString();
  await db.doc(`offices/${officeId}`).set({ onboardingCompletedAt: completedAt, updatedAt: completedAt }, { merge: true });
  await audit(officeId, uid, 'onboarding.completed', 'office', officeId);
  return { completedAt };
});

export const createCheckout = onCall({ region: 'southamerica-east1', secrets: [asaasApiKey], enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const planCode = String(request.data?.planCode || '');
  if (!PLAN_VALUES[planCode]) throw new HttpsError('invalid-argument', 'Plano inválido.');
  const { officeId, office } = await requireOfficeManager(uid);
  const cpfCnpj = String(request.data?.cpfCnpj || '').replace(/\D/g, '');
  const officeRef = db.doc(`offices/${officeId}`);
  const leaseId = randomBytes(12).toString('hex');
  await db.runTransaction(async transaction => {
    const current = await transaction.get(officeRef);
    if (Number(current.data()?.billingCheckoutLeaseUntil || 0) > Date.now()) throw new HttpsError('aborted', 'Já existe uma contratação em processamento.');
    transaction.set(officeRef, { billingCheckoutLeaseId: leaseId, billingCheckoutLeaseUntil: Date.now() + 2 * 60 * 1000 }, { merge: true });
  });
  try {
    const existingCustomers = office.billingCustomerId ? null : await asaasRequest(`/customers?externalReference=${encodeURIComponent(officeId)}&limit=1`);
    if (!office.billingCustomerId && !(Array.isArray(existingCustomers?.data) && existingCustomers.data[0]) && ![11, 14].includes(cpfCnpj.length)) throw new HttpsError('invalid-argument', 'CPF ou CNPJ é obrigatório para criar o pagador.');
    const customer = office.billingCustomerId
      ? { id: office.billingCustomerId }
      : (Array.isArray(existingCustomers?.data) && existingCustomers.data[0]) || await asaasRequest('/customers', { method: 'POST', body: JSON.stringify({ name: office.name, email: office.email, mobilePhone: office.whatsapp, cpfCnpj, externalReference: officeId }) });
    const reusableSubscriptionId = office.subscriptionStatus === 'CANCELED' ? null : office.billingSubscriptionId;
    const existingSubscriptions = reusableSubscriptionId ? null : await asaasRequest(`/subscriptions?externalReference=${encodeURIComponent(officeId)}&status=ACTIVE&limit=1`);
    const subscription = reusableSubscriptionId
      ? await asaasRequest(`/subscriptions/${reusableSubscriptionId}`)
      : (Array.isArray(existingSubscriptions?.data) && existingSubscriptions.data[0]) || await asaasRequest('/subscriptions', { method: 'POST', body: JSON.stringify({ customer: customer.id, billingType: 'UNDEFINED', value: PLAN_VALUES[planCode], cycle: 'MONTHLY', nextDueDate: new Date(Date.now() + 3 * DAY_MS).toISOString().slice(0, 10), description: `Presença Jurídica CRM — ${planCode}`, externalReference: officeId }) });
    if (Number(subscription.value) !== PLAN_VALUES[planCode]) await asaasRequest(`/subscriptions/${subscription.id}`, { method: 'PUT', body: JSON.stringify({ value: PLAN_VALUES[planCode] }) });
    const paymentsResponse = await asaasRequest(`/subscriptions/${subscription.id}/payments`);
    const firstPayment = Array.isArray(paymentsResponse.data) ? paymentsResponse.data[0] : null;
    await officeRef.set({ billingCustomerId: customer.id, billingSubscriptionId: subscription.id, billingProvider: 'asaas', planCode, limits: PLAN_LIMITS[planCode], subscriptionStatus: 'PAST_DUE', graceEndsAtMs: Date.now() + 5 * DAY_MS, graceEndsAt: new Date(Date.now() + 5 * DAY_MS).toISOString(), billingCheckoutLeaseId: null, billingCheckoutLeaseUntil: null, subscriptionUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
    await db.doc(`subscriptions/${officeId}`).set({ id: officeId, officeId, planCode, status: 'PAST_DUE', provider: 'asaas', providerCustomerId: customer.id, providerSubscriptionId: subscription.id, nextDueDate: subscription.nextDueDate || null, updatedAt: new Date().toISOString() }, { merge: true });
    await audit(officeId, uid, 'billing.checkout_created', 'subscription', subscription.id, { planCode });
    return { checkoutUrl: firstPayment?.invoiceUrl || `${appUrl.value()}/billing?status=pending`, subscriptionId: subscription.id };
  } catch (error) {
    const current = await officeRef.get();
    if (current.data()?.billingCheckoutLeaseId === leaseId) await officeRef.set({ billingCheckoutLeaseId: null, billingCheckoutLeaseUntil: null }, { merge: true });
    throw error;
  }
});

export const changePlan = onCall({ region: 'southamerica-east1', secrets: [asaasApiKey], enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const planCode = String(request.data?.planCode || '');
  if (!PLAN_VALUES[planCode]) throw new HttpsError('invalid-argument', 'Plano inválido.');
  const { officeId, office } = await requireOfficeManager(uid);
  if (!office.billingSubscriptionId) throw new HttpsError('failed-precondition', 'Nenhuma assinatura encontrada.');
  const subscription = await asaasRequest(`/subscriptions/${office.billingSubscriptionId}`, { method: 'PUT', body: JSON.stringify({ value: PLAN_VALUES[planCode] }) });
  await db.doc(`offices/${officeId}`).set({ planCode, limits: PLAN_LIMITS[planCode], subscriptionUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
  await db.doc(`subscriptions/${officeId}`).set({ id: officeId, officeId, planCode, updatedAt: new Date().toISOString() }, { merge: true });
  await audit(officeId, uid, 'billing.plan_changed', 'subscription', office.billingSubscriptionId as string, { planCode });
  return { checkoutUrl: subscription.invoiceUrl || `${appUrl.value()}/billing?status=updated`, subscriptionId: office.billingSubscriptionId };
});

export const cancelSubscription = onCall({ region: 'southamerica-east1', secrets: [asaasApiKey], enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId, office } = await requireOfficeManager(uid);
  if (!office.billingSubscriptionId) throw new HttpsError('failed-precondition', 'Nenhuma assinatura encontrada.');
  await asaasRequest(`/subscriptions/${office.billingSubscriptionId}`, { method: 'DELETE' });
  await db.doc(`offices/${officeId}`).set({ subscriptionStatus: 'CANCELED', subscriptionUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
  await db.doc(`subscriptions/${officeId}`).set({ id: officeId, officeId, status: 'CANCELED', canceledAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
  await audit(officeId, uid, 'billing.subscription_canceled', 'subscription', office.billingSubscriptionId as string);
  return { status: 'CANCELED' };
});

export const getBillingSummary = onCall({ region: 'southamerica-east1', secrets: [asaasApiKey], enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { office } = await requireOfficeManager(uid);
  if (!office.billingSubscriptionId) return { billingType: null, payments: [] };
  const [subscription, paymentsResponse] = await Promise.all([
    asaasRequest(`/subscriptions/${office.billingSubscriptionId}`),
    asaasRequest(`/subscriptions/${office.billingSubscriptionId}/payments`),
  ]);
  const payments = Array.isArray(paymentsResponse.data) ? paymentsResponse.data : [];
  return {
    billingType: subscription.billingType || null,
    payments: payments.slice(0, 24).map((payment: Record<string, unknown>) => ({ id: String(payment.id || ''), status: String(payment.status || ''), billingType: String(payment.billingType || ''), dueDate: String(payment.dueDate || ''), value: Number(payment.value || 0), invoiceUrl: payment.invoiceUrl ? String(payment.invoiceUrl) : null, bankSlipUrl: payment.bankSlipUrl ? String(payment.bankSlipUrl) : null })),
  };
});

export const updateBillingMethod = onCall({ region: 'southamerica-east1', secrets: [asaasApiKey], enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId, office } = await requireOfficeManager(uid);
  const billingType = String(request.data?.billingType || '');
  if (!['PIX', 'BOLETO', 'CREDIT_CARD'].includes(billingType)) throw new HttpsError('invalid-argument', 'Forma de pagamento inválida.');
  if (!office.billingSubscriptionId) throw new HttpsError('failed-precondition', 'Nenhuma assinatura encontrada.');
  await asaasRequest(`/subscriptions/${office.billingSubscriptionId}`, { method: 'PUT', body: JSON.stringify({ billingType, updatePendingPayments: true }) });
  await audit(officeId, uid, 'billing.method_changed', 'subscription', String(office.billingSubscriptionId), { billingType });
  return { billingType };
});

export const inviteMember = onCall({ region: 'southamerica-east1', secrets: [resendApiKey], enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId, office } = await requireOfficeManager(uid);
  const email = String(request.data?.email || '').trim().toLowerCase();
  const role = String(request.data?.role || 'read');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido.');
  if (!['lawyer', 'assistant', 'finance', 'read'].includes(role)) throw new HttpsError('invalid-argument', 'Perfil inválido.');
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const id = `${officeId}_${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;
  const counterRef = await ensureUsageCounter(officeId);
  const invitationRef = db.doc(`invitations/${id}`);
  const now = new Date().toISOString();
  await db.runTransaction(async transaction => {
    const [counter, existingInvitation] = await Promise.all([transaction.get(counterRef), transaction.get(invitationRef)]);
    if (existingInvitation.data()?.status === 'pending') throw new HttpsError('already-exists', 'Já existe um convite pendente para este e-mail.');
    if (existingInvitation.data()?.status === 'accepted') throw new HttpsError('already-exists', 'Este e-mail já integra o escritório.');
    const users = Number(counter.data()?.users || 0);
    if (users >= limitsForOffice(office).maxUsers) throw new HttpsError('resource-exhausted', 'Limite de usuários do plano atingido.');
    transaction.set(invitationRef, { id, officeId, email, role, tokenHash, status: 'pending', expiresAt: new Date(Date.now() + 7 * DAY_MS).toISOString(), createdBy: uid, createdAt: existingInvitation.data()?.createdAt || now, updatedAt: now });
    transaction.set(counterRef, { users: users + 1, refreshedAt: now }, { merge: true });
  });
  await audit(officeId, uid, 'members.invitation_created', 'invitation', id, { email, role });
  const invitationUrl = `${appUrl.value()}/convite/${token}`;
  const emailSent = await sendEmail(email, 'Convite para o Presença Jurídica', `Você foi convidado para integrar o escritório no Presença Jurídica. O convite expira em 7 dias: ${invitationUrl}`).then(() => true).catch(error => { console.error(JSON.stringify({ action: 'invitation_email_failed', officeId, invitationId: id, error: String(error) })); return false; });
  return { invitationUrl, emailSent };
});

export const revokeInvitation = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId } = await requireOfficeManager(uid);
  const invitationId = requiredText(request.data?.invitationId, 'Convite', 1, 160);
  const invitationRef = db.doc(`invitations/${invitationId}`);
  const counterRef = await ensureUsageCounter(officeId);
  await db.runTransaction(async transaction => {
    const [invitation, counter] = await Promise.all([transaction.get(invitationRef), transaction.get(counterRef)]);
    if (!invitation.exists || invitation.data()?.officeId !== officeId || invitation.data()?.status !== 'pending') throw new HttpsError('not-found', 'Convite pendente não encontrado.');
    transaction.update(invitationRef, { status: 'revoked', updatedAt: new Date().toISOString(), revokedBy: uid });
    transaction.set(counterRef, { users: Math.max(0, Number(counter.data()?.users || 0) - 1), refreshedAt: new Date().toISOString() }, { merge: true });
  });
  await audit(officeId, uid, 'members.invitation_revoked', 'invitation', invitationId);
  return { status: 'revoked' };
});

export const resendInvitation = onCall({ region: 'southamerica-east1', secrets: [resendApiKey], enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId } = await requireOfficeManager(uid);
  const invitationId = requiredText(request.data?.invitationId, 'Convite', 1, 160);
  const invitationRef = db.doc(`invitations/${invitationId}`);
  const invitation = await invitationRef.get();
  if (!invitation.exists || invitation.data()?.officeId !== officeId || invitation.data()?.status !== 'pending') throw new HttpsError('not-found', 'Convite pendente não encontrado.');
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const invitationUrl = `${appUrl.value()}/convite/${token}`;
  await invitationRef.update({ tokenHash, expiresAt: new Date(Date.now() + 7 * DAY_MS).toISOString(), updatedAt: new Date().toISOString(), resentBy: uid });
  await sendEmail(String(invitation.data()?.email || ''), 'Novo link do convite para o Presença Jurídica', `Use este novo link, válido por 7 dias: ${invitationUrl}`);
  await audit(officeId, uid, 'members.invitation_resent', 'invitation', invitationId);
  return { invitationUrl, emailSent: true };
});

export const listPendingInvitations = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId } = await requireOfficeManager(uid);
  const snapshot = await db.collection('invitations').where('officeId', '==', officeId).where('status', '==', 'pending').get();
  return {
    invitations: snapshot.docs.map(item => {
      const data = item.data();
      return { id: item.id, officeId, email: data.email, role: data.role, status: data.status, expiresAt: data.expiresAt, createdBy: data.createdBy, createdAt: data.createdAt, updatedAt: data.updatedAt };
    }),
  };
});

export const acceptInvitation = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const token = String(request.data?.token || '');
  if (token.length < 32) throw new HttpsError('invalid-argument', 'Convite inválido.');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const snapshot = await db.collection('invitations').where('tokenHash', '==', tokenHash).where('status', '==', 'pending').limit(1).get();
  if (snapshot.empty) throw new HttpsError('not-found', 'Convite inexistente ou já utilizado.');
  const invitation = snapshot.docs[0];
  const data = invitation.data();
  if (new Date(data.expiresAt).getTime() <= Date.now()) throw new HttpsError('deadline-exceeded', 'Convite expirado.');
  const authUser = await getAuth().getUser(uid);
  if ((authUser.email || '').toLowerCase() !== String(data.email).toLowerCase()) throw new HttpsError('permission-denied', 'Entre com o e-mail que recebeu o convite.');
  const existingUser = await db.doc(`users/${uid}`).get();
  if (existingUser.exists && existingUser.data()?.officeId && existingUser.data()?.officeId !== data.officeId) throw new HttpsError('failed-precondition', 'Esta conta já está vinculada a outro escritório.');
  const now = new Date().toISOString();
  const membershipId = `${data.officeId}_${uid}`;
  const batch = db.batch();
  batch.set(db.doc(`users/${uid}`), { id: uid, name: authUser.displayName || authUser.email || '', email: authUser.email || data.email, role: data.role, officeId: data.officeId, updatedAt: now, createdAt: now }, { merge: true });
  batch.set(db.doc(`memberships/${membershipId}`), { id: membershipId, officeId: data.officeId, userId: uid, email: authUser.email || data.email, name: authUser.displayName || authUser.email || '', role: data.role, status: 'active', createdAt: now, updatedAt: now });
  batch.update(invitation.ref, { status: 'accepted', acceptedBy: uid, acceptedAt: now, updatedAt: now });
  await batch.commit();
  await audit(data.officeId, uid, 'members.invitation_accepted', 'invitation', invitation.id);
  return { officeId: data.officeId };
});

export const setMemberStatus = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId } = await requireOfficeManager(uid);
  const targetUserId = String(request.data?.userId || '');
  const status = String(request.data?.status || '');
  if (!targetUserId || !['blocked', 'removed', 'active'].includes(status)) throw new HttpsError('invalid-argument', 'Membro ou status inválido.');
  if (targetUserId === uid) throw new HttpsError('failed-precondition', 'O próprio proprietário não pode remover seu acesso.');
  const membershipRef = db.doc(`memberships/${officeId}_${targetUserId}`);
  const membership = await membershipRef.get();
  if (!membership.exists || membership.data()?.officeId !== officeId || membership.data()?.role === 'owner') throw new HttpsError('not-found', 'Membro não encontrado ou protegido.');
  const now = new Date().toISOString();
  const batch = db.batch();
  batch.update(membershipRef, { status, updatedAt: now });
  if (status === 'removed') batch.set(db.doc(`users/${targetUserId}`), { officeId: '', role: 'read', updatedAt: now }, { merge: true });
  await batch.commit();
  await refreshUsage(officeId);
  await audit(officeId, uid, `members.${status}`, 'membership', membershipRef.id, { targetUserId });
  return { status };
});

export const getDocumentDownloadUrl = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const documentId = String(request.data?.documentId || '');
  const portalToken = request.data?.portalToken ? String(request.data.portalToken) : '';
  if (!documentId) throw new HttpsError('invalid-argument', 'Documento inválido.');
  const documentSnapshot = await db.doc(`leadDocuments/${documentId}`).get();
  if (!documentSnapshot.exists) throw new HttpsError('not-found', 'Documento não encontrado.');
  const documentData = documentSnapshot.data() as { officeId: string; leadId: string; storagePath: string };
  const officeId = documentData.officeId;
  let actorUserId = 'public_portal';
  if (portalToken) {
    const portalSnapshot = await db.doc(`clientPortalAccess/${portalToken}`).get();
    const portal = portalSnapshot.data();
    const expiresAtMs = Number(portal?.expiresAtMs || 0);
    const allowedDocument = Array.isArray(portal?.documents) && portal.documents.some((item: { id?: string }) => item.id === documentId);
    if (!portalSnapshot.exists || portal?.isActive !== true || (expiresAtMs > 0 && expiresAtMs <= Date.now()) || portal?.officeId !== officeId || portal?.leadId !== documentData.leadId || !allowedDocument) throw new HttpsError('permission-denied', 'Documento não liberado no portal.');
  } else {
    const uid = requireAuth(request);
    const user = await getUser(uid);
    const membership = user.officeId ? await db.doc(`memberships/${user.officeId}_${uid}`).get() : null;
    if (user.officeId !== officeId || (membership?.exists && membership.data()?.status !== 'active')) throw new HttpsError('permission-denied', 'Acesso ao documento não autorizado.');
    actorUserId = uid;
  }
  const [downloadUrl] = await getStorage(getApp()).bucket().file(documentData.storagePath).getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000 });
  await audit(officeId, actorUserId, 'documents.downloaded', 'leadDocument', documentId, { portal: Boolean(portalToken) });
  return { downloadUrl, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
});

export const createDocumentUpload = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId, office } = await requireOfficeOperator(uid);
  const leadId = requiredText(request.data?.leadId, 'Contato', 1, 128);
  const fileName = requiredText(request.data?.fileName, 'Nome do arquivo', 1, 240);
  const contentType = optionalText(request.data?.contentType, 150) || 'application/octet-stream';
  const size = Number(request.data?.size || 0);
  if (!Number.isSafeInteger(size) || size <= 0 || size > 15 * 1024 * 1024) throw new HttpsError('invalid-argument', 'O arquivo deve ter no máximo 15 MB.');
  const leadSnapshot = await db.doc(`leads/${leadId}`).get();
  if (!leadSnapshot.exists || leadSnapshot.data()?.officeId !== officeId) throw new HttpsError('not-found', 'Contato não encontrado.');
  const counterRef = await ensureUsageCounter(officeId);
  const uploadRef = db.collection('pendingUploads').doc();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-180) || 'arquivo';
  const storagePath = `offices/${officeId}/leads/${leadId}/documents/${uploadRef.id}/${safeFileName}`;
  const expiresAtMs = Date.now() + 15 * 60 * 1000;
  await db.runTransaction(async transaction => {
    const counter = await transaction.get(counterRef);
    const used = Number(counter.data()?.storageBytes || 0);
    const reserved = Number(counter.data()?.storageReservedBytes || 0);
    if (used + reserved + size > limitsForOffice(office).maxStorageBytes) throw new HttpsError('resource-exhausted', 'Limite de armazenamento do plano atingido.');
    transaction.create(uploadRef, { id: uploadRef.id, officeId, leadId, fileName, contentType, expectedSize: size, storagePath, category: optionalText(request.data?.category, 100) || 'Outro', visibleInPortal: request.data?.visibleInPortal === true, uploadedBy: uid, status: 'pending', expiresAtMs, createdAt: new Date().toISOString() });
    transaction.set(counterRef, { storageReservedBytes: reserved + size, refreshedAt: new Date().toISOString() }, { merge: true });
  });
  try {
    const [uploadUrl] = await getStorage(getApp()).bucket().file(storagePath).getSignedUrl({ version: 'v4', action: 'write', expires: expiresAtMs, contentType });
    return { uploadId: uploadRef.id, uploadUrl, expiresAt: new Date(expiresAtMs).toISOString() };
  } catch (error) {
    await db.runTransaction(async transaction => {
      const [upload, counter] = await Promise.all([transaction.get(uploadRef), transaction.get(counterRef)]);
      if (!upload.exists || upload.data()?.status !== 'pending') return;
      transaction.delete(uploadRef);
      transaction.set(counterRef, { storageReservedBytes: Math.max(0, Number(counter.data()?.storageReservedBytes || 0) - size), refreshedAt: new Date().toISOString() }, { merge: true });
    });
    throw error;
  }
});

export const finalizeDocumentUpload = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId } = await requireOfficeOperator(uid);
  const uploadId = requiredText(request.data?.uploadId, 'Upload', 1, 128);
  const uploadRef = db.doc(`pendingUploads/${uploadId}`);
  const uploadSnapshot = await uploadRef.get();
  const upload = uploadSnapshot.data() as Record<string, unknown> | undefined;
  if (uploadSnapshot.exists && upload?.officeId === officeId && upload?.uploadedBy === uid && upload?.status === 'completed') return { documentId: uploadId };
  if (!uploadSnapshot.exists || upload?.officeId !== officeId || upload?.uploadedBy !== uid || upload?.status !== 'pending') throw new HttpsError('not-found', 'Reserva de upload não encontrada.');
  if (Number(upload.expiresAtMs || 0) <= Date.now()) throw new HttpsError('deadline-exceeded', 'Reserva de upload expirada.');
  const file = getStorage(getApp()).bucket().file(String(upload.storagePath));
  const [metadata] = await file.getMetadata().catch(() => { throw new HttpsError('failed-precondition', 'Arquivo ainda não foi enviado.'); });
  const actualSize = Number(metadata.size || 0);
  const expectedSize = Number(upload.expectedSize || 0);
  if (actualSize !== expectedSize || actualSize <= 0) {
    await file.delete({ ignoreNotFound: true });
    const counterRef = await ensureUsageCounter(officeId);
    await db.runTransaction(async transaction => {
      const [currentUpload, counter] = await Promise.all([transaction.get(uploadRef), transaction.get(counterRef)]);
      if (!currentUpload.exists || currentUpload.data()?.status !== 'pending') return;
      transaction.update(uploadRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
      transaction.set(counterRef, { storageReservedBytes: Math.max(0, Number(counter.data()?.storageReservedBytes || 0) - expectedSize), refreshedAt: new Date().toISOString() }, { merge: true });
    });
    throw new HttpsError('failed-precondition', 'O tamanho recebido não corresponde ao arquivo reservado.');
  }
  const documentRef = db.doc(`leadDocuments/${uploadId}`);
  const counterRef = await ensureUsageCounter(officeId);
  const now = new Date().toISOString();
  await db.runTransaction(async transaction => {
    const [currentUpload, counter, existingDocument] = await Promise.all([transaction.get(uploadRef), transaction.get(counterRef), transaction.get(documentRef)]);
    if (existingDocument.exists) return;
    if (!currentUpload.exists || currentUpload.data()?.status !== 'pending') throw new HttpsError('failed-precondition', 'Upload já finalizado ou cancelado.');
    const reserved = Number(counter.data()?.storageReservedBytes || 0);
    const storageBytes = Number(counter.data()?.storageBytes || 0);
    transaction.create(documentRef, { id: uploadId, officeId, leadId: upload.leadId, name: upload.fileName, fileName: upload.fileName, contentType: metadata.contentType || upload.contentType, size: actualSize, storagePath: upload.storagePath, downloadUrl: '', category: upload.category, visibleInPortal: upload.visibleInPortal === true, uploadedBy: uid, createdAt: now, updatedAt: now });
    transaction.update(uploadRef, { status: 'completed', completedAt: now });
    transaction.set(counterRef, { storageReservedBytes: Math.max(0, reserved - expectedSize), storageBytes: storageBytes + actualSize, refreshedAt: now }, { merge: true });
  });
  await audit(officeId, uid, 'documents.uploaded', 'leadDocument', uploadId, { size: actualSize });
  return { documentId: uploadId };
});

export const transferOwnership = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId, office } = await requireOfficeManager(uid);
  const currentUser = await getUser(uid);
  if (currentUser.role !== 'owner') throw new HttpsError('permission-denied', 'Somente o proprietário atual pode transferir a propriedade.');
  const targetUserId = String(request.data?.userId || '');
  if (!targetUserId || targetUserId === uid) throw new HttpsError('invalid-argument', 'Novo proprietário inválido.');
  const targetMembershipRef = db.doc(`memberships/${officeId}_${targetUserId}`);
  const targetMembership = await targetMembershipRef.get();
  if (!targetMembership.exists || targetMembership.data()?.status !== 'active') throw new HttpsError('failed-precondition', 'O novo proprietário precisa ser membro ativo.');
  const now = new Date().toISOString();
  const batch = db.batch();
  batch.set(db.doc(`users/${uid}`), { role: 'admin', updatedAt: now }, { merge: true });
  batch.set(db.doc(`users/${targetUserId}`), { role: 'owner', updatedAt: now }, { merge: true });
  batch.set(db.doc(`memberships/${officeId}_${uid}`), { role: 'admin', updatedAt: now }, { merge: true });
  batch.set(targetMembershipRef, { role: 'owner', updatedAt: now }, { merge: true });
  batch.set(db.doc(`offices/${officeId}`), { ownerUserId: targetUserId, updatedAt: now }, { merge: true });
  await batch.commit();
  await audit(officeId, uid, 'members.ownership_transferred', 'office', officeId, { previousOwner: uid, newOwner: targetUserId });
  return { officeId, previousOwner: uid, newOwner: targetUserId };
});

export const exportOfficeData = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId } = await requireOfficeManager(uid);
  const collections = ['offices', 'memberships', 'subscriptions', 'leads', 'leadEvents', 'tasks', 'leadDocuments', 'calendarEvents', 'financialRecords', 'clientPortalAccess', 'auditLogs'];
  const output: Record<string, unknown[]> = {};
  for (const collectionName of collections) {
    const query = collectionName === 'offices' ? await db.doc(`offices/${officeId}`).get() : await db.collection(collectionName).where('officeId', '==', officeId).get();
    output[collectionName] = 'docs' in query ? query.docs.map(item => item.data()) : query.exists ? [query.data()] : [];
  }
  await audit(officeId, uid, 'privacy.export_requested', 'office', officeId);
  return { officeId, exportedAt: new Date().toISOString(), data: output };
});

export const requestOfficeDeletion = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId } = await requireOfficeManager(uid);
  const deletionScheduledAt = new Date(Date.now() + 30 * DAY_MS).toISOString();
  await db.doc(`offices/${officeId}`).set({ deletionScheduledAt, updatedAt: new Date().toISOString() }, { merge: true });
  await audit(officeId, uid, 'privacy.deletion_requested', 'office', officeId, { deletionScheduledAt });
  return { deletionScheduledAt };
});

export const cancelOfficeDeletion = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const { officeId } = await requireOfficeManager(uid);
  await db.doc(`offices/${officeId}`).set({ deletionScheduledAt: null, updatedAt: new Date().toISOString() }, { merge: true });
  await audit(officeId, uid, 'privacy.deletion_canceled', 'office', officeId);
  return { canceled: true };
});

export const submitPrivacyRequest = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const email = requiredText(request.data?.email, 'E-mail', 5, 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido.');
  const requestType = String(request.data?.requestType || 'access');
  if (!['access', 'correction', 'deletion', 'portability', 'information', 'revocation'].includes(requestType)) throw new HttpsError('invalid-argument', 'Tipo de solicitação inválido.');
  const details = requiredText(request.data?.details, 'Detalhes', 10, 3000);
  const protocol = `LGPD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
  const userId = request.auth?.uid || null;
  const user = userId ? await getUser(userId) : null;
  await db.doc(`privacyRequests/${protocol}`).set({ id: protocol, protocol, officeId: user?.officeId || null, userId, email, requestType, details, status: 'received', source: userId ? 'authenticated' : 'public', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  if (user?.officeId) await audit(user.officeId, userId || 'public', 'privacy.data_subject_request', 'privacyRequest', protocol, { requestType });
  return { protocol };
});

export const acceptLegalTerms = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  if (request.data?.accepted !== true || request.data?.version !== '2026-09-06-v1') throw new HttpsError('invalid-argument', 'Aceite legal inválido.');
  const user = await getUser(uid);
  const now = new Date().toISOString();
  await db.doc(`users/${uid}`).set({ acceptedTermsVersion: '2026-09-06-v1', acceptedTermsAt: now, acceptedPrivacyVersion: '2026-09-06-v1', acceptedPrivacyAt: now, updatedAt: now }, { merge: true });
  if (user.officeId) await audit(user.officeId, uid, 'legal.terms_accepted', 'user', uid, { version: '2026-09-06-v1' });
  return { version: '2026-09-06-v1', acceptedAt: now };
});

export const recordLoginEvent = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const user = await getUser(uid);
  const eventRef = db.collection('authEvents').doc();
  const now = new Date().toISOString();
  await eventRef.set({ id: eventRef.id, officeId: user.officeId || null, userId: uid, type: 'login', provider: 'google', createdAt: now });
  if (user.officeId) await audit(user.officeId, uid, 'auth.login', 'user', uid);
  return { recordedAt: now };
});

export const submitSupportTicket = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const user = await getUser(uid);
  const subject = requiredText(request.data?.subject, 'Assunto', 5, 160);
  const message = requiredText(request.data?.message, 'Mensagem', 10, 5000);
  const ticketRef = db.collection('supportTickets').doc();
  await ticketRef.set({ id: ticketRef.id, officeId: user.officeId || null, userId: uid, email: user.email || null, subject, message, status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  if (user.officeId) await audit(user.officeId, uid, 'support.ticket_created', 'supportTicket', ticketRef.id);
  return { ticketId: ticketRef.id };
});

export const health = onRequest({ region: 'southamerica-east1', cors: true }, async (_request, response) => {
  try {
    await db.doc('_system/health').get();
    response.set('cache-control', 'no-store').status(200).json({ status: 'ok', service: 'presenca-juridica-functions', timestamp: new Date().toISOString(), databaseId });
  } catch (error) {
    console.error(JSON.stringify({ action: 'health_check_failed', error: String(error) }));
    response.set('cache-control', 'no-store').status(503).json({ status: 'degraded', timestamp: new Date().toISOString() });
  }
});

export const listPlatformOffices = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);
  const snapshot = await db.collection('offices').orderBy('updatedAt', 'desc').limit(200).get();
  return { offices: snapshot.docs.map(item => ({ id: item.id, ...item.data() })) };
});

export const setPlatformOfficeStatus = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);
  const officeId = String(request.data?.officeId || '');
  const status = String(request.data?.status || '');
  if (!officeId || !['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELED'].includes(status)) throw new HttpsError('invalid-argument', 'Status inválido.');
  await db.doc(`offices/${officeId}`).set({ subscriptionStatus: status, subscriptionUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
  await db.doc(`subscriptions/${officeId}`).set({ id: officeId, officeId, status, updatedAt: new Date().toISOString() }, { merge: true });
  await audit(officeId, uid, 'admin.subscription_status_changed', 'office', officeId, { status });
  return { status };
});

export const requestSupportAccess = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);
  const officeId = requiredText(request.data?.officeId, 'Escritório', 1, 128);
  const reason = requiredText(request.data?.reason, 'Motivo', 10, 500);
  if (!(await db.doc(`offices/${officeId}`).get()).exists) throw new HttpsError('not-found', 'Escritório não encontrado.');
  const requestRef = db.collection('supportAccessRequests').doc();
  await requestRef.set({ id: requestRef.id, officeId, requestedBy: uid, reason, status: 'pending', requestedAt: new Date().toISOString(), requestExpiresAtMs: Date.now() + DAY_MS, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await audit(officeId, uid, 'support.access_requested', 'supportAccessRequest', requestRef.id, { reason });
  return { requestId: requestRef.id };
});

export const listSupportAccessRequests = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const user = await getUser(uid);
  let snapshot;
  if (user.globalRole === 'platform_admin') snapshot = await db.collection('supportAccessRequests').where('requestedBy', '==', uid).limit(100).get();
  else {
    if (user.role !== 'owner' || !user.officeId) throw new HttpsError('permission-denied', 'Somente o proprietário pode autorizar suporte.');
    snapshot = await db.collection('supportAccessRequests').where('officeId', '==', user.officeId).limit(100).get();
  }
  return { requests: snapshot.docs.map(item => item.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) };
});

export const decideSupportAccess = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  const user = await getUser(uid);
  if (user.role !== 'owner' || !user.officeId) throw new HttpsError('permission-denied', 'Somente o proprietário pode decidir.');
  const requestId = requiredText(request.data?.requestId, 'Solicitação', 1, 128);
  const decision = String(request.data?.decision || '');
  if (!['approved', 'denied', 'revoked'].includes(decision)) throw new HttpsError('invalid-argument', 'Decisão inválida.');
  const accessRef = db.doc(`supportAccessRequests/${requestId}`);
  const snapshot = await accessRef.get();
  if (!snapshot.exists || snapshot.data()?.officeId !== user.officeId) throw new HttpsError('not-found', 'Solicitação não encontrada.');
  if (decision !== 'revoked' && snapshot.data()?.status !== 'pending') throw new HttpsError('failed-precondition', 'Solicitação já decidida.');
  const expiresAtMs = decision === 'approved' ? Date.now() + 60 * 60 * 1000 : null;
  await accessRef.update({ status: decision, decidedBy: uid, decidedAt: new Date().toISOString(), expiresAtMs, updatedAt: new Date().toISOString() });
  await audit(user.officeId, uid, `support.access_${decision}`, 'supportAccessRequest', requestId);
  return { status: decision, expiresAtMs };
});

export const getSupportOfficeSnapshot = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);
  const requestId = requiredText(request.data?.requestId, 'Autorização', 1, 128);
  const access = await db.doc(`supportAccessRequests/${requestId}`).get();
  const data = access.data();
  if (!access.exists || data?.requestedBy !== uid || data?.status !== 'approved' || Number(data?.expiresAtMs || 0) <= Date.now()) throw new HttpsError('permission-denied', 'Autorização ausente ou expirada.');
  const officeId = String(data.officeId);
  const [office, usage, leads, tasks] = await Promise.all([db.doc(`offices/${officeId}`).get(), db.doc(`usageCounters/${officeId}`).get(), db.collection('leads').where('officeId', '==', officeId).count().get(), db.collection('tasks').where('officeId', '==', officeId).count().get()]);
  await audit(officeId, uid, 'support.snapshot_viewed', 'supportAccessRequest', requestId);
  return { office: office.data(), usage: usage.data() || null, counts: { leads: leads.data().count, tasks: tasks.data().count }, accessExpiresAtMs: data.expiresAtMs };
});

export const listOperationsInbox = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);
  const [privacy, support, billing, integration] = await Promise.all([
    db.collection('privacyRequests').orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('supportTickets').orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('billingEvents').orderBy('receivedAt', 'desc').limit(100).get(),
    db.collection('integrationErrors').orderBy('createdAt', 'desc').limit(100).get(),
  ]);
  return { privacyRequests: privacy.docs.map(item => item.data()), supportTickets: support.docs.map(item => item.data()), integrationErrors: [...integration.docs.map(item => item.data()), ...billing.docs.map(item => item.data()).filter(item => item.status === 'failed')] };
});

export const getPlatformMetrics = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);
  const offices = await db.collection('offices').get();
  const rows = offices.docs.map(item => item.data());
  const active = rows.filter(item => item.subscriptionStatus === 'ACTIVE').length;
  const trials = rows.filter(item => item.subscriptionStatus === 'TRIALING').length;
  const canceled = rows.filter(item => item.subscriptionStatus === 'CANCELED').length;
  const activated = rows.filter(item => Boolean(item.onboardingCompletedAt)).length;
  const mrr = rows.filter(item => item.subscriptionStatus === 'ACTIVE').reduce((total, item) => total + Number(PLAN_VALUES[String(item.planCode)] || 0), 0);
  return { totalOffices: rows.length, active, trials, canceled, activated, activationRate: rows.length ? Math.round((activated / rows.length) * 1000) / 10 : 0, conversionRate: rows.length ? Math.round((active / rows.length) * 1000) / 10 : 0, mrr };
});

export const updateOperationsInboxItem = onCall({ region: 'southamerica-east1', enforceAppCheck: true }, async request => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);
  const kind = String(request.data?.kind || '');
  const id = requiredText(request.data?.id, 'Item', 1, 160);
  const status = String(request.data?.status || '');
  const collectionName = kind === 'privacy' ? 'privacyRequests' : kind === 'support' ? 'supportTickets' : '';
  const allowedStatuses = kind === 'privacy' ? ['received', 'in_review', 'completed', 'rejected'] : ['open', 'in_progress', 'resolved', 'closed'];
  if (!collectionName || !allowedStatuses.includes(status)) throw new HttpsError('invalid-argument', 'Item ou status inválido.');
  const itemRef = db.doc(`${collectionName}/${id}`);
  if (!(await itemRef.get()).exists) throw new HttpsError('not-found', 'Item não encontrado.');
  await itemRef.update({ status, handledBy: uid, resolutionNote: optionalText(request.data?.resolutionNote, 2000) || null, updatedAt: new Date().toISOString() });
  return { status };
});

export const asaasWebhook = onRequest({ region: 'southamerica-east1', secrets: [asaasWebhookToken, resendApiKey] }, async (request, response) => {
  if (request.headers['asaas-access-token'] !== asaasWebhookToken.value()) { response.status(401).send('unauthorized'); return; }
  const event = request.body as Record<string, any>;
  const eventId = String(event.id || createHash('sha256').update(JSON.stringify(event)).digest('hex'));
  const eventRef = db.doc(`billingEvents/${eventId}`);
  let claimed = false;
  await db.runTransaction(async transaction => {
    const existing = await transaction.get(eventRef);
    if (existing.exists) {
      if (existing.data()?.status !== 'failed') return;
      transaction.update(eventRef, { status: 'received', error: null, receivedAt: new Date().toISOString(), retryCount: Number(existing.data()?.retryCount || 0) + 1 });
      claimed = true;
      return;
    }
    transaction.create(eventRef, { id: eventId, provider: 'asaas', eventType: event.event, externalId: event.payment?.id || event.subscription?.id || eventId, paymentStatus: event.payment?.status || null, amount: Number(event.payment?.value || 0), status: 'received', receivedAt: new Date().toISOString() });
    claimed = true;
  });
  if (!claimed) { response.status(200).send('already_processed'); return; }
  try {
    const subscriptionId = event.subscription?.id || event.payment?.subscription;
    if (!subscriptionId) { await eventRef.update({ status: 'ignored', processedAt: new Date().toISOString() }); response.status(200).send('ignored'); return; }
    const offices = await db.collection('offices').where('billingSubscriptionId', '==', subscriptionId).limit(1).get();
    const externalOfficeId = String(event.subscription?.externalReference || event.payment?.externalReference || '');
    const fallbackOffice = externalOfficeId ? await db.doc(`offices/${externalOfficeId}`).get() : null;
    if (offices.empty && !fallbackOffice?.exists) { await eventRef.update({ status: 'ignored', processedAt: new Date().toISOString() }); response.status(200).send('unknown_subscription'); return; }
    const office = offices.empty ? fallbackOffice! : offices.docs[0];
    if (!office.data()?.billingSubscriptionId) await office.ref.set({ billingSubscriptionId: subscriptionId, billingProvider: 'asaas', updatedAt: new Date().toISOString() }, { merge: true });
    const paymentConfirmed = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(String(event.event));
    const overdue = ['PAYMENT_OVERDUE', 'PAYMENT_DUNNING_RECEIVED', 'PAYMENT_REPROVED'].includes(String(event.event));
    const canceled = ['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'].includes(String(event.event));
    const nextStatus = paymentConfirmed ? 'ACTIVE' : overdue ? 'GRACE_PERIOD' : canceled ? 'CANCELED' : undefined;
    const parsedEventAt = Date.parse(String(event.dateCreated || ''));
    const eventAtMs = Number.isFinite(parsedEventAt) ? parsedEventAt : Date.now();
    await db.runTransaction(async transaction => {
      const currentOffice = await transaction.get(office.ref);
      if (eventAtMs < Number(currentOffice.data()?.billingLastEventAtMs || 0)) return;
      transaction.set(office.ref, { ...(nextStatus ? { subscriptionStatus: nextStatus } : {}), ...(overdue ? { graceEndsAtMs: Date.now() + 5 * DAY_MS, graceEndsAt: new Date(Date.now() + 5 * DAY_MS).toISOString() } : {}), ...(paymentConfirmed ? { graceEndsAtMs: null, graceEndsAt: null } : {}), billingLastEventAtMs: eventAtMs, subscriptionUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
    });
    if (nextStatus) await db.doc(`subscriptions/${office.id}`).set({ id: office.id, officeId: office.id, status: nextStatus, updatedAt: new Date().toISOString() }, { merge: true });
    await eventRef.update({ officeId: office.id, status: 'processed', processedAt: new Date().toISOString() });
    const officeData = office.data();
    if (nextStatus && officeData?.email) {
      const messages: Record<string, [string, string]> = {
        ACTIVE: ['Pagamento confirmado', 'Seu pagamento foi confirmado e o acesso completo ao Presença Jurídica está ativo.'],
        GRACE_PERIOD: ['Pagamento vencido', 'Não identificamos o pagamento. O acesso permanece disponível por cinco dias para regularização.'],
        CANCELED: ['Assinatura cancelada', 'A assinatura foi cancelada. Seus dados seguem a política contratual de retenção.'],
      };
      const message = messages[nextStatus];
      if (message) await sendEmail(String(officeData.email), message[0], message[1]).catch(emailError => console.error(JSON.stringify({ action: 'billing_email_failed', officeId: office.id, eventId, error: String(emailError) })));
    }
    response.status(200).send('processed');
  } catch (error) {
    await eventRef.update({ status: 'failed', error: String(error).slice(0, 1000), processedAt: new Date().toISOString() });
    await recordIntegrationError('asaas', 'webhook', error);
    console.error(JSON.stringify({ action: 'asaas_webhook_failed', eventId, error: String(error) }));
    response.status(500).send('processing_failed');
  }
});

const sendEmail = async (to: string, subject: string, text: string) => {
  if (!resendApiKey.value()) throw new Error('RESEND_API_KEY não configurada.');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendApiKey.value()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: emailFrom.value(), to: [to], subject, text }) });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
};

export const processTrialNotifications = onSchedule({ region: 'southamerica-east1', schedule: 'every day 09:00', timeZone: 'America/Sao_Paulo', secrets: [resendApiKey] }, async () => {
  const snapshot = await db.collection('offices').where('subscriptionStatus', '==', 'TRIALING').get();
  const now = Date.now();
  for (const office of snapshot.docs) {
    const data = office.data();
    if (!data.trialStartedAt || !data.email) continue;
    const elapsedDay = Math.floor((now - new Date(data.trialStartedAt).getTime()) / DAY_MS) + 1;
    if (![7, 12, 14, 15].includes(elapsedDay)) continue;
    const notificationRef = db.doc(`notifications/${office.id}_trial_${elapsedDay}`);
    const existing = await notificationRef.get();
    if (existing.data()?.status === 'sent') continue;
    await notificationRef.set({ officeId: office.id, type: 'trial', day: elapsedDay, status: 'processing', attempts: FieldValue.increment(1), updatedAt: new Date().toISOString(), createdAt: existing.data()?.createdAt || new Date().toISOString() }, { merge: true });
    try {
      await sendEmail(data.email, elapsedDay === 15 ? 'Seu teste do Presença Jurídica terminou' : `Seu teste do Presença Jurídica está no dia ${elapsedDay}`, elapsedDay === 15 ? 'Escolha um plano para manter o acesso completo ao CRM.' : 'Continue o onboarding e organize o primeiro atendimento antes do fim do período de teste.');
      await notificationRef.update({ status: 'sent', sentAt: new Date().toISOString(), error: null });
    } catch (error) {
      await notificationRef.update({ status: 'failed', error: String(error).slice(0, 1000), updatedAt: new Date().toISOString() });
      console.error(JSON.stringify({ action: 'trial_email_failed', officeId: office.id, day: elapsedDay, error: String(error) }));
    }
  }
});

export const reconcileSubscriptionStates = onSchedule({ region: 'southamerica-east1', schedule: 'every 6 hours', timeZone: 'America/Sao_Paulo' }, async () => {
  const snapshot = await db.collection('offices').where('subscriptionStatus', 'in', ['TRIALING', 'GRACE_PERIOD']).get();
  const now = Date.now();
  for (const office of snapshot.docs) {
    const data = office.data();
    const shouldSuspend = (data.subscriptionStatus === 'TRIALING' && Number(data.trialEndsAtMs) > 0 && now >= Number(data.trialEndsAtMs)) || (data.subscriptionStatus === 'GRACE_PERIOD' && Number(data.graceEndsAtMs) > 0 && now >= Number(data.graceEndsAtMs));
    if (shouldSuspend) {
      await office.ref.set({ subscriptionStatus: 'SUSPENDED', subscriptionUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
      await db.doc(`subscriptions/${office.id}`).set({ id: office.id, officeId: office.id, status: 'SUSPENDED', updatedAt: new Date().toISOString() }, { merge: true });
    }
  }
});

export const reconcileAsaasSubscriptions = onSchedule({ region: 'southamerica-east1', schedule: 'every day 05:30', timeZone: 'America/Sao_Paulo', secrets: [asaasApiKey], timeoutSeconds: 540 }, async () => {
  const offices = await db.collection('offices').where('billingProvider', '==', 'asaas').limit(300).get();
  for (const office of offices.docs) {
    const data = office.data();
    if (!data.billingSubscriptionId) continue;
    try {
      const [subscription, paymentsResponse] = await Promise.all([asaasRequest(`/subscriptions/${data.billingSubscriptionId}`), asaasRequest(`/subscriptions/${data.billingSubscriptionId}/payments`)]);
      const payments = Array.isArray(paymentsResponse.data) ? paymentsResponse.data : [];
      const latest = payments.sort((a: Record<string, unknown>, b: Record<string, unknown>) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')))[0];
      const paid = latest && ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(latest.status));
      const overdue = latest && ['OVERDUE', 'DUNNING_RECEIVED'].includes(String(latest.status));
      const canceled = ['INACTIVE', 'EXPIRED'].includes(String(subscription.status));
      const nextStatus = canceled ? 'CANCELED' : paid ? 'ACTIVE' : overdue ? 'GRACE_PERIOD' : undefined;
      if (!nextStatus) continue;
      const startsGrace = nextStatus === 'GRACE_PERIOD' && data.subscriptionStatus !== 'GRACE_PERIOD';
      await office.ref.set({ subscriptionStatus: nextStatus, ...(startsGrace ? { graceEndsAtMs: Date.now() + 5 * DAY_MS, graceEndsAt: new Date(Date.now() + 5 * DAY_MS).toISOString() } : {}), ...(nextStatus === 'ACTIVE' ? { graceEndsAtMs: null, graceEndsAt: null } : {}), subscriptionUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
      await db.doc(`subscriptions/${office.id}`).set({ id: office.id, officeId: office.id, status: nextStatus, nextDueDate: subscription.nextDueDate || latest?.dueDate || null, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      await recordIntegrationError('asaas', 'daily_reconciliation', error, office.id);
      console.error(JSON.stringify({ action: 'asaas_reconciliation_failed', officeId: office.id, error: String(error) }));
    }
  }
});

export const processScheduledDeletions = onSchedule({ region: 'southamerica-east1', schedule: 'every day 03:30', timeZone: 'America/Sao_Paulo' }, async () => {
  const snapshot = await db.collection('offices').where('deletionScheduledAt', '<=', new Date().toISOString()).limit(20).get();
  const collections = ['memberships', 'invitations', 'subscriptions', 'leads', 'leadEvents', 'tasks', 'leadDocuments', 'calendarEvents', 'financialRecords', 'clientPortalAccess', 'auditLogs', 'authEvents', 'usageCounters', 'billingEvents', 'integrationErrors', 'notifications', 'pendingUploads', 'privacyRequests', 'supportTickets', 'supportAccessRequests'];
  for (const office of snapshot.docs) {
    const data = office.data();
    for (const collectionName of collections) {
      let items = await db.collection(collectionName).where('officeId', '==', office.id).limit(400).get();
      while (!items.empty) {
        const batch = db.batch();
        items.docs.forEach(item => batch.delete(item.ref));
        await batch.commit();
        items = await db.collection(collectionName).where('officeId', '==', office.id).limit(400).get();
      }
    }
    const users = await db.collection('users').where('officeId', '==', office.id).get();
    const userBatch = db.batch();
    users.docs.forEach(item => userBatch.set(item.ref, { officeId: '', role: 'read', updatedAt: new Date().toISOString() }, { merge: true }));
    await userBatch.commit();
    await office.ref.delete();
    console.info(JSON.stringify({ action: 'office_deleted_after_retention', officeId: office.id, ownerUserId: data.ownerUserId }));
  }
});

const BACKUP_COLLECTIONS = ['memberships', 'invitations', 'subscriptions', 'leads', 'leadEvents', 'tasks', 'leadDocuments', 'calendarEvents', 'financialRecords', 'clientPortalAccess', 'auditLogs', 'authEvents', 'usageCounters', 'billingEvents', 'integrationErrors', 'notifications', 'privacyRequests', 'supportTickets', 'supportAccessRequests'];

export const backupTenantData = onSchedule({ region: 'southamerica-east1', schedule: 'every 5 minutes', timeZone: 'America/Sao_Paulo', timeoutSeconds: 540, memory: '1GiB' }, async () => {
  const cursorRef = db.doc('_system/backupCursor');
  const cursor = await cursorRef.get();
  const date = new Date().toISOString().slice(0, 10);
  const lastOfficeId = cursor.data()?.cycleDate === date ? String(cursor.data()?.lastOfficeId || '') : '';
  let query = db.collection('offices').orderBy(FieldPath.documentId()).limit(5);
  if (lastOfficeId) query = query.startAfter(lastOfficeId);
  const offices = await query.get();
  const bucket = getStorage(getApp()).bucket();
  if (offices.empty) {
    await cursorRef.set({ cycleDate: date, lastOfficeId: '', completedAt: new Date().toISOString() });
    const [files] = await bucket.getFiles({ prefix: 'backups/' });
    const cutoff = Date.now() - 30 * DAY_MS;
    await Promise.all(files.filter(file => new Date(String(file.metadata.timeCreated || 0)).getTime() < cutoff).map(file => file.delete({ ignoreNotFound: true })));
    return;
  }
  for (const office of offices.docs) {
    const data: Record<string, Array<{ id: string; data: Record<string, unknown> }>> = { offices: [{ id: office.id, data: office.data() }] };
    for (const collectionName of BACKUP_COLLECTIONS) {
      const snapshot = collectionName === 'usageCounters'
        ? await db.collection(collectionName).where('officeId', '==', office.id).get()
        : await db.collection(collectionName).where('officeId', '==', office.id).get();
      data[collectionName] = snapshot.docs.map(item => ({ id: item.id, data: item.data() }));
    }
    const payload = Buffer.from(JSON.stringify({ version: 1, officeId: office.id, databaseId, createdAt: new Date().toISOString(), collections: data }));
    const checksum = createHash('sha256').update(payload).digest('hex');
    await bucket.file(`backups/${office.id}/${date}.json.gz`).save(gzipSync(payload), { resumable: false, contentType: 'application/gzip', metadata: { metadata: { officeId: office.id, checksum, databaseId } } });
  }
  await cursorRef.set({ cycleDate: date, lastOfficeId: offices.docs[offices.docs.length - 1].id, updatedAt: new Date().toISOString() });
  console.info(JSON.stringify({ action: 'tenant_backup_completed', offices: offices.size, date }));
});

const refreshUsage = async (officeId: string) => {
  const [users, invitations, contacts, documents, pendingUploads] = await Promise.all([
    db.collection('memberships').where('officeId', '==', officeId).where('status', 'in', ['active', 'blocked']).count().get(),
    db.collection('invitations').where('officeId', '==', officeId).where('status', '==', 'pending').count().get(),
    db.collection('leads').where('officeId', '==', officeId).count().get(),
    db.collection('leadDocuments').where('officeId', '==', officeId).get(),
    db.collection('pendingUploads').where('officeId', '==', officeId).where('status', '==', 'pending').get(),
  ]);
  const storageBytes = documents.docs.reduce((total, item) => total + Number(item.data().size || 0), 0);
  const storageReservedBytes = pendingUploads.docs.filter(item => Number(item.data().expiresAtMs || 0) > Date.now()).reduce((total, item) => total + Number(item.data().expectedSize || 0), 0);
  await db.doc(`usageCounters/${officeId}`).set({ officeId, users: users.data().count + invitations.data().count, contacts: contacts.data().count, storageBytes, storageReservedBytes, refreshedAt: new Date().toISOString() });
};

export const refreshUsageOnLead = onDocumentCreated({ region: 'southamerica-east1', database: databaseId, document: 'leads/{leadId}' }, async event => { const officeId = String(event.data?.data()?.officeId || ''); if (officeId) await refreshUsage(officeId); });
export const refreshUsageOnDocument = onDocumentCreated({ region: 'southamerica-east1', database: databaseId, document: 'leadDocuments/{documentId}' }, async event => { const officeId = String(event.data?.data()?.officeId || ''); if (officeId) await refreshUsage(officeId); });
export const refreshUsageOnLeadDeleted = onDocumentDeleted({ region: 'southamerica-east1', database: databaseId, document: 'leads/{leadId}' }, async event => { const officeId = String(event.data?.data()?.officeId || ''); if (officeId) await refreshUsage(officeId); });
export const cleanupDeletedDocument = onDocumentDeleted({ region: 'southamerica-east1', database: databaseId, document: 'leadDocuments/{documentId}' }, async event => {
  const data = event.data?.data();
  if (data?.storagePath) await getStorage(getApp()).bucket().file(String(data.storagePath)).delete({ ignoreNotFound: true });
  if (data?.officeId) await refreshUsage(String(data.officeId));
});

export const initializeOfficeSaasState = onDocumentCreated({ region: 'southamerica-east1', database: databaseId, document: 'offices/{officeId}' }, async event => {
  const officeId = String(event.params.officeId);
  const office = event.data?.data() || {};
  await Promise.all([
    ensureUsageCounter(officeId),
    db.doc(`subscriptions/${officeId}`).set({ id: officeId, officeId, planCode: office.planCode || 'trial', status: office.subscriptionStatus || 'TRIALING', provider: 'asaas', providerCustomerId: null, providerSubscriptionId: null, nextDueDate: null, canceledAt: null, updatedAt: new Date().toISOString() }, { merge: true }),
  ]);
});

export const syncPlanCatalog = onSchedule({ region: 'southamerica-east1', schedule: 'every day 01:30', timeZone: 'America/Sao_Paulo' }, async () => {
  const catalog = {
    trial: { code: 'trial', name: 'Teste', priceCents: 0, interval: null, limits: PLAN_LIMITS.trial },
    essential: { code: 'essential', name: 'Essencial', priceCents: 14900, interval: 'month', limits: PLAN_LIMITS.essential },
    professional: { code: 'professional', name: 'Profissional', priceCents: 24900, interval: 'month', limits: PLAN_LIMITS.professional },
    custom: { code: 'custom', name: 'Personalizado', priceCents: null, interval: null, limits: PLAN_LIMITS.custom },
  };
  const batch = db.batch();
  Object.entries(catalog).forEach(([id, plan]) => batch.set(db.doc(`plans/${id}`), { ...plan, updatedAt: new Date().toISOString() }, { merge: true }));
  await batch.commit();
});

export const cleanupExpiredReservations = onSchedule({ region: 'southamerica-east1', schedule: 'every 30 minutes', timeZone: 'America/Sao_Paulo' }, async () => {
  const expiredUploads = await db.collection('pendingUploads').where('status', '==', 'pending').where('expiresAtMs', '<=', Date.now()).limit(200).get();
  for (const item of expiredUploads.docs) {
    const upload = item.data();
    const counterRef = await ensureUsageCounter(String(upload.officeId));
    await db.runTransaction(async transaction => {
      const [current, counter] = await Promise.all([transaction.get(item.ref), transaction.get(counterRef)]);
      if (!current.exists || current.data()?.status !== 'pending') return;
      transaction.update(item.ref, { status: 'expired', expiredAt: new Date().toISOString() });
      transaction.set(counterRef, { storageReservedBytes: Math.max(0, Number(counter.data()?.storageReservedBytes || 0) - Number(upload.expectedSize || 0)), refreshedAt: new Date().toISOString() }, { merge: true });
    });
    if (upload.storagePath) await getStorage(getApp()).bucket().file(String(upload.storagePath)).delete({ ignoreNotFound: true });
  }
  const expiredInvitations = await db.collection('invitations').where('status', '==', 'pending').where('expiresAt', '<=', new Date().toISOString()).limit(200).get();
  for (const item of expiredInvitations.docs) {
    const invitation = item.data();
    const counterRef = await ensureUsageCounter(String(invitation.officeId));
    await db.runTransaction(async transaction => {
      const [current, counter] = await Promise.all([transaction.get(item.ref), transaction.get(counterRef)]);
      if (!current.exists || current.data()?.status !== 'pending') return;
      transaction.update(item.ref, { status: 'expired', updatedAt: new Date().toISOString() });
      transaction.set(counterRef, { users: Math.max(0, Number(counter.data()?.users || 0) - 1), refreshedAt: new Date().toISOString() }, { merge: true });
    });
  }
});

const deleteQueryBatch = async (collectionName: string, field: string, cutoff: string | number) => {
  const snapshot = await db.collection(collectionName).where(field, '<=', cutoff).limit(400).get();
  if (snapshot.empty) return 0;
  const batch = db.batch();
  snapshot.docs.forEach(item => batch.delete(item.ref));
  await batch.commit();
  return snapshot.size;
};

export const enforceRetentionPolicy = onSchedule({ region: 'southamerica-east1', schedule: 'every day 04:30', timeZone: 'America/Sao_Paulo' }, async () => {
  const now = Date.now();
  const iso = (milliseconds: number) => new Date(milliseconds).toISOString();
  const expiredPortals = await db.collection('clientPortalAccess').where('expiresAtMs', '<=', now).limit(400).get();
  if (!expiredPortals.empty) {
    const batch = db.batch();
    expiredPortals.docs.forEach(item => batch.set(item.ref, { isActive: false, updatedAt: new Date().toISOString() }, { merge: true }));
    await batch.commit();
  }
  const deleted = {
    auditLogs: await deleteQueryBatch('auditLogs', 'createdAt', iso(now - 2 * 365 * DAY_MS)),
    authEvents: await deleteQueryBatch('authEvents', 'createdAt', iso(now - 2 * 365 * DAY_MS)),
    billingEvents: await deleteQueryBatch('billingEvents', 'receivedAt', iso(now - 2 * 365 * DAY_MS)),
    integrationErrors: await deleteQueryBatch('integrationErrors', 'createdAt', iso(now - 365 * DAY_MS)),
    notifications: await deleteQueryBatch('notifications', 'createdAt', iso(now - 180 * DAY_MS)),
    completedUploads: await deleteQueryBatch('pendingUploads', 'createdAt', iso(now - 7 * DAY_MS)),
    supportAccess: await deleteQueryBatch('supportAccessRequests', 'createdAt', iso(now - 365 * DAY_MS)),
  };
  console.info(JSON.stringify({ action: 'retention_policy_completed', expiredPortals: expiredPortals.size, deleted }));
});
