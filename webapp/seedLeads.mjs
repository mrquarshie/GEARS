// One-off seed script: pushes src/leads/leadData.json into the live
// `mechanics` Firestore collection, additively — it only ever calls addDoc,
// never touches or deletes anything already in the collection.
//
// Firestore rules require an authenticated write (firestore.rules:24), so
// this signs in with a real GEARS account first. Run it as:
//
//   SEED_EMAIL="you@example.com" SEED_PASSWORD="..." node seedLeads.mjs
//
// Credentials are read from your own shell env — never hardcode them here
// or paste them into chat.
//
// A lead is only published if it has real name/area/phone (no leftover
// "TODO" placeholder text) and isn't explicitly flagged not to publish
// (see internal.classificationFlag, e.g. R3hub). Everything skipped is
// printed at the end with the reason, instead of silently going live with
// placeholder or misclassified data. Pass --force to publish everything
// regardless (not recommended — see the printed skip reasons first).

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = {
  apiKey: 'AIzaSyBwUsHF7jo9MUfVVz42bdYPss0TK9M2Zog',
  authDomain: 'gears-c88f8.firebaseapp.com',
  projectId: 'gears-c88f8',
};

const FORCE = process.argv.includes('--force');

function isPlaceholder(value) {
  return typeof value !== 'string' || value.trim() === '' || value.includes('TODO');
}

function readiness(entry) {
  const reasons = [];
  if (isPlaceholder(entry.name)) reasons.push('name missing/placeholder');
  if (isPlaceholder(entry.area)) reasons.push('area missing/placeholder');
  // A business needs a phone OR an email (some are email-only by choice —
  // see firestore.rules:29-30) — only flag it if BOTH are missing/placeholder.
  if (isPlaceholder(entry.phone) && isPlaceholder(entry.email)) reasons.push('phone/email missing/placeholder');
  if (entry.internal?.classificationFlag) reasons.push(`flagged: ${entry.internal.classificationFlag}`);
  return reasons;
}

async function main() {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  if (!email || !password) {
    console.error('Set SEED_EMAIL and SEED_PASSWORD in your shell before running this.');
    process.exit(1);
  }

  const leads = JSON.parse(readFileSync(new URL('./src/leads/leadData.json', import.meta.url)));

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email}`);

  const skipped = [];
  const created = [];

  for (const lead of leads) {
    const reasons = readiness(lead);
    if (reasons.length && !FORCE) {
      skipped.push({ name: lead.name, reasons });
      continue;
    }

    const { internal, ...publicData } = lead;
    const docRef = await addDoc(collection(db, 'mechanics'), {
      ...publicData,
      // Tier 2 ("Profile Claimed") on arrival, not tier 3 (unclaimed) — these
      // are pitch-workflow leads with a profile Gears set up on their behalf,
      // just not yet vetted. Flip to verified: true (tier 1, see main.jsx:1547)
      // once a business is actually confirmed/vetted.
      claimed: true,
      verified: false,
      source: 'lead-import',
      createdAt: serverTimestamp(),
    });
    created.push({ name: lead.name, id: docRef.id });
  }

  console.log(`\nCreated ${created.length} mechanic doc(s):`);
  created.forEach((c) => console.log(`  ${c.name} -> id ${c.id}  (share link: <your-prod-origin>/?mechanic=${c.id})`));

  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} (rerun with --force to publish anyway):`);
    skipped.forEach((s) => console.log(`  ${s.name}: ${s.reasons.join('; ')}`));
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
