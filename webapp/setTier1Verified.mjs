// One-off script: flips `verified: true` on the live Firestore docs for the
// 12 businesses that have been fully accepted. Requires the firestore.rules
// update deployed alongside this script (admin can update the `verified`
// field alone on a doc it doesn't own).
//
// Run it yourself with your own admin credentials — this writes to the live
// `mechanics` collection:
//
//   node setTier1Verified.mjs
//
// It will prompt for your admin email + password (not stored anywhere).
// Matches docs by exact `name` (case-insensitive) and only ever sets
// `verified: true`; it never creates, deletes, or touches any other field.

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { createInterface } from 'readline';

const config = {
  apiKey: 'AIzaSyBwUsHF7jo9MUfVVz42bdYPss0TK9M2Zog',
  authDomain: 'gears-c88f8.firebaseapp.com',
  projectId: 'gears-c88f8',
};

const TIER1_NAMES = [
  'Highest Auto Detailing',
  'Uncle Fii Spare Parts',
  'DATES Limited',
  'Protech Auto Care',
  'The Ghana Mechanic',
  'Police',
  'Paapa',
  'Tetteh',
  'KB Car Services',
  'Johani Auto Cool Ltd',
  'Richy Ray Auto Pro',
  'Akasima Auto Parts',
].map((n) => n.toLowerCase());

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  const email = await prompt('Admin email: ');
  const password = await prompt('Admin password: ');

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  await signInWithEmailAndPassword(auth, email.trim(), password);

  const snap = await getDocs(collection(db, 'mechanics'));
  const updated = [];
  const alreadySet = [];
  const notFound = new Set(TIER1_NAMES);

  for (const d of snap.docs) {
    const data = d.data();
    const nameKey = (data.name || '').trim().toLowerCase();
    if (!TIER1_NAMES.includes(nameKey)) continue;
    notFound.delete(nameKey);
    if (data.verified === true) {
      alreadySet.push(data.name);
      continue;
    }
    await updateDoc(doc(db, 'mechanics', d.id), { verified: true });
    updated.push(data.name);
  }

  console.log(`\nUpdated ${updated.length}:`, updated);
  if (alreadySet.length) console.log(`\nAlready verified (${alreadySet.length}):`, alreadySet);
  if (notFound.size) console.log(`\nNot found in Firestore (check they've been seeded) (${notFound.size}):`, [...notFound]);

  process.exit(0);
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
