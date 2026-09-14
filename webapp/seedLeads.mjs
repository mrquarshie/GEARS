// One-off seed script: pushes the pitch leads (src/leads/leadData.json) and
// the demo fuel stations (src/mockExtras.json) into the live `mechanics`
// Firestore collection, additively.
//
// Each lead gets its own placeholder Firebase account using the generic
// `accountEmail` / `accountPassword` fields in leadData.json (e.g.
// <slug>@gears-ghana.com / Gears@2026), so the listing has a real `createdBy`
// uid — the §3.3 pitch flow. Fuel stations share a single generic staff
// account (gears-staff@gears-ghana.com).
//
// No admin sign-in is required: createUserWithEmailAndPassword creates each
// account (and signs in as it) directly, which satisfies the "authenticated
// write" requirement in firestore.rules. Run it as:
//
//   node seedLeads.mjs
//
// Idempotent-ish: if an account already exists (re-run), it signs in with the
// same credentials instead of failing. A business is skipped if a mechanic
// with the same phone (or email) already exists. Pass --force to publish
// leads with placeholder/TODO data anyway (not recommended).

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

const config = {
  apiKey: 'AIzaSyBwUsHF7jo9MUfVVz42bdYPss0TK9M2Zog',
  authDomain: 'gears-c88f8.firebaseapp.com',
  projectId: 'gears-c88f8',
};

const FORCE = process.argv.includes('--force');
const STAFF_EMAIL = 'gears-staff@gears-ghana.com';
const STAFF_PASSWORD = 'Gears@2026';

// The admin account that onboards these businesses on Gears' behalf. Every
// listing gets `onboardedBy` = this uid so it shows up in that admin's
// business switcher/dashboard, even though `createdBy` stays the business's
// own placeholder account (handed off later). Keep in sync with the admin's
// Firebase Auth uid (princeessandoh316@gmail.com).
const ADMIN_UID = 'JY9zFP6sgXP9euC58dGVVglKvpa2';

function isPlaceholder(value) {
  return typeof value !== 'string' || value.trim() === '' || value.includes('TODO');
}

function readiness(entry) {
  const reasons = [];
  if (isPlaceholder(entry.name)) reasons.push('name missing/placeholder');
  if (isPlaceholder(entry.area)) reasons.push('area missing/placeholder');
  // A business needs a phone OR an email (some are email-only by choice —
  // see firestore.rules) — only flag it if BOTH are missing/placeholder.
  if (isPlaceholder(entry.phone) && isPlaceholder(entry.email)) reasons.push('phone/email missing/placeholder');
  if (entry.internal?.classificationFlag) reasons.push(`flagged: ${entry.internal.classificationFlag}`);
  return reasons;
}

async function getOrCreateAccountUid(auth, email, password) {
  try {
    return (await createUserWithEmailAndPassword(auth, email, password)).user.uid;
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      return (await signInWithEmailAndPassword(auth, email, password)).user.uid;
    }
    throw e;
  }
}

async function main() {
  const leads = JSON.parse(readFileSync(new URL('./src/leads/leadData.json', import.meta.url)));
  const fuelStations = JSON.parse(readFileSync(new URL('./src/mockExtras.json', import.meta.url)))
    .filter((m) => m.specialty === 'Fuel Station');

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Snapshot of what's already live, so a re-run doesn't duplicate anything.
  // Placeholder values (e.g. a --force-published lead whose phone is still
  // literally "TODO") are excluded — otherwise the first "TODO" phone/email
  // seeded poisons this set and every later lead sharing that same
  // placeholder gets wrongly skipped as a "duplicate".
  const existingPhones = new Set();
  const existingEmails = new Set();
  (await getDocs(collection(db, 'mechanics'))).forEach((d) => {
    const data = d.data();
    if (!isPlaceholder(data.phone)) existingPhones.add(data.phone.trim());
    if (!isPlaceholder(data.email)) existingEmails.add(data.email.trim().toLowerCase());
  });

  const created = [];
  const skipped = [];
  const accounts = [];

  // --- Fuel stations: curated brand listings, owned by one generic staff account ---
  const staffUid = await getOrCreateAccountUid(auth, STAFF_EMAIL, STAFF_PASSWORD);
  for (const station of fuelStations) {
    const reasons = readiness(station);
    if (reasons.length && !FORCE) {
      skipped.push({ name: station.name, kind: 'fuel', reasons });
      continue;
    }
    const phoneKey = !isPlaceholder(station.phone) ? station.phone.trim() : null;
    if (phoneKey && existingPhones.has(phoneKey)) {
      skipped.push({ name: station.name, kind: 'fuel', reasons: ['already exists (phone match)'] });
      continue;
    }
    const docRef = await addDoc(collection(db, 'mechanics'), {
      ...station,
      claimed: true,
      verified: false,
      createdBy: staffUid,
      onboardedBy: ADMIN_UID,
      source: 'fuel-import',
      createdAt: serverTimestamp(),
    });
    created.push({ name: station.name, id: docRef.id });
    if (phoneKey) existingPhones.add(phoneKey);
  }

  // --- Leads: each gets its own placeholder account from leadData.json ---
  for (const lead of leads) {
    const reasons = readiness(lead);
    if (reasons.length && !FORCE) {
      skipped.push({ name: lead.name, kind: 'lead', reasons });
      continue;
    }

    const phoneKey = !isPlaceholder(lead.phone) ? lead.phone.trim() : null;
    const emailKey = !isPlaceholder(lead.email) ? lead.email.trim().toLowerCase() : null;
    if ((phoneKey && existingPhones.has(phoneKey)) || (emailKey && existingEmails.has(emailKey))) {
      skipped.push({ name: lead.name, kind: 'lead', reasons: ['already exists (phone/email match)'] });
      continue;
    }

    const accountEmail = lead.accountEmail;
    const accountPassword = lead.accountPassword;
    if (!accountEmail || !accountPassword) {
      skipped.push({ name: lead.name, kind: 'lead', reasons: ['no accountEmail/accountPassword in leadData.json'] });
      continue;
    }

    let uid;
    try {
      uid = await getOrCreateAccountUid(auth, accountEmail, accountPassword);
    } catch (e) {
      skipped.push({ name: lead.name, kind: 'lead', reasons: [`account error: ${e.message}`] });
      continue;
    }

    // Strip the internal + credential fields so they never land on the doc.
    const { internal, accountEmail: _e, accountPassword: _p, ...publicData } = lead;
    const docRef = await addDoc(collection(db, 'mechanics'), {
      ...publicData,
      claimed: true,
      verified: false,
      createdBy: uid,
      onboardedBy: ADMIN_UID,
      source: 'pitch-import',
      createdAt: serverTimestamp(),
    });
    created.push({ name: lead.name, id: docRef.id });
    accounts.push({ name: lead.name, mechanicId: docRef.id, uid, email: accountEmail, password: accountPassword });
    if (phoneKey) existingPhones.add(phoneKey);
    if (emailKey) existingEmails.add(emailKey);
  }

  console.log(`\nCreated ${created.length} mechanic doc(s):`);
  created.forEach((c) => console.log(`  ${c.name} -> id ${c.id}`));

  if (accounts.length) {
    const outPath = new URL('./pitch-accounts.json', import.meta.url);
    writeFileSync(outPath, JSON.stringify(accounts, null, 2));
    console.log(`\nPitch accounts (${accounts.length}) written to ${outPath} — keep for handoff:`);
    accounts.forEach((a) => console.log(`  ${a.name}\n    uid ${a.uid}\n    ${a.email}  /  ${a.password}`));
  }

  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} (rerun with --force to publish anyway):`);
    skipped.forEach((s) => console.log(`  [${s.kind}] ${s.name}: ${s.reasons.join('; ')}`));
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
