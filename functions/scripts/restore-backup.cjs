const { readFileSync } = require('node:fs');
const { gunzipSync } = require('node:zlib');
const { initializeApp, applicationDefault, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const [backupPath, confirmation] = process.argv.slice(2);
if (!backupPath || !confirmation?.startsWith('--confirm-office=')) {
  throw new Error('Uso: npm run restore:backup -- <arquivo.json.gz> --confirm-office=<officeId>');
}
const payload = JSON.parse(gunzipSync(readFileSync(backupPath)).toString('utf8'));
const confirmedOfficeId = confirmation.split('=')[1];
if (!payload.officeId || payload.officeId !== confirmedOfficeId) throw new Error('A confirmação não corresponde ao officeId do backup.');

initializeApp({ credential: applicationDefault() });
const database = getFirestore(getApp(), process.env.FIRESTORE_DATABASE_ID || payload.databaseId || '(default)');

(async () => {
  for (const [collectionName, documents] of Object.entries(payload.collections || {})) {
    for (let offset = 0; offset < documents.length; offset += 400) {
      const batch = database.batch();
      for (const document of documents.slice(offset, offset + 400)) batch.set(database.doc(`${collectionName}/${document.id}`), document.data, { merge: true });
      await batch.commit();
    }
  }
  console.log(JSON.stringify({ status: 'restored', officeId: payload.officeId, collections: Object.keys(payload.collections || {}) }));
})().catch(error => { console.error(error); process.exitCode = 1; });
