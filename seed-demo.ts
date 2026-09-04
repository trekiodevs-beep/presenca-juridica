import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function seed() {
  const officesSnap = await getDocs(collection(db, 'offices'));
  if (officesSnap.empty) {
    console.error('No office found.');
    process.exit(1);
  }
  const officeId = officesSnap.docs[0].id;

  await setDoc(doc(db, 'publicForms', 'clara-almeida-demo'), {
    officeId: officeId,
    officeName: 'Clara Almeida Advocacia',
    lawyerName: 'Dra. Clara Almeida — modelo fictício',
    city: 'Poços de Caldas',
    state: 'MG',
    areas: ['Direito de Família', 'Direito Sucessório'],
    isActive: true,
    slug: 'clara-almeida-demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  console.log('Successfully seeded publicForms/clara-almeida-demo');
  process.exit(0);
}

seed().catch(console.error);
