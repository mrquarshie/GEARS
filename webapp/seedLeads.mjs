// One-off seed script: pushes the pitch leads (src/leads/leadData.json) and
// the demo fuel stations (src/mockExtras.json) into the live `mechanics`
// Firestore collection, additively.
//
// Leads — each published lead gets its own placeholder Firebase account
// (a "dummy" email + random password) so the listing is owned by a real
// `createdBy` uid, the §3.3 pitch flow. The dummy creds are printed and
// written to pitch-accounts.json for later handoff to the real business
// (rotate via the `handoffBusinessAccount` Cloud Function, or relay as-is).
//
// Fuel stations — curated brand listings (Goil/Total) owned by the admin
// account doing the seeding, so createdBy = the admin's uid.
//
// Firestore rules require an authenticated write (firestore.rules create),
// so this signs in with a real GEARS account first. Run it as:
//
//   SEED_EMAIL="you@example.com" SEED_PASSWORD="..." node seedLeads.mjs
//
// Credentials are read from your shell env — never hardcode them here or
// paste them into chat.
//
// A lead is only published if it has real name/area/phone (no leftover
// "TODO" placeholder text) and isn't explicitly flagged not to publish
// (see internal.classificationFlag, e.g. R3hub). A business is also skipped
// if a mechanic with the same phone (or email) already exists, so re-running
// won't duplicate docs or accounts. Pass --force to publish everything
// regardless (not recommended — see the printed skip reasons first).

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

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
  // see firestore.rules) — only flag it if BOTH are missing/placeholder.
  if (isPlaceholder(entry.phone) && isPlaceholder(entry.email)) reasons.push('phone/email missing/placeholder');
  if (entry.internal?.classificationFlag) reasons.push(`flagged: ${entry.internal.classificationFlag}`);
  return reasons;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Dummy accounts alias the admin's own inbox (e.g. admin+pitch-<slug>@gmail.com),
// so any Firebase email for that account lands with the admin for handoff.
function dummyEmailFor(slug, adminEmail) {
  const at = adminEmail.lastIndexOf('@');
  const local = at === -1 ? adminEmail : adminEmail.slice(0, at);
  const domain = at === -1 ? 'gmail.com' : adminEmail.slice(at + 1);
  return `${local}+pitch-${slug}@${domain}`;
}

function generatePassword() {
  return `Gears!${Math.random().toString(36).slice(2, 10)}A1`;
}

async function main() {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  if (!email || !password) {
    console.error('Set SEED_EMAIL and SEED_PASSWORD in your shell before running this.');
    process.exit(1);
  }

  const leads = JSON.parse(readFileSync(new URL('./src/leads/leadData.json', import.meta.url)));
  const fuelStations = JSON.parse(readFileSync(new URL('./src/mockExtras.json', import.meta.url)))
    .filter((m) => m.specialty === 'Fuel Station');

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Snapshot of what's already live, so a re-run doesn't duplicate anything.
  const existingPhones = new Set();
  const existingEmails = new Set();
  (await getDocs(collection(db, 'mechanics'))).forEach((d) => {
    const data = d.data();
    if (typeof data.phone === 'string' && data.phone.trim()) existingPhones.add(data.phone.trim());
    if (typeof data.email === 'string' && data.email.trim()) existingEmails.add(data.email.trim().toLowerCase());
  });

  const adminUid = (await signInWithEmailAndPassword(auth, email, password)).user.uid;
  console.log(`Signed in as ${email} (admin uid ${adminUid})`);

  const created = [];
  const skipped = [];
  const accounts = [];

  // --- Fuel stations: curated brand listings owned by the admin account ---
  for (const station of fuelStations) {
    const reasons = readiness(station);
    if (reasons.length && !FORCE) {
      skipped.push({ name: station.name, kind: 'fuel', reasons });
      continue;
    }
    const phoneKey = typeof station.phone === 'string' && station.phone.trim() ? station.phone.trim() : null;
    if (phoneKey && existingPhones.has(phoneKey)) {
      skipped.push({ name: station.name, kind: 'fuel', reasons: ['already exists (phone match)'] });
      continue;
    }
    const docRef = await addDoc(collection(db, 'mechanics'), {
      ...station,
      claimed: true,
      verified: false,
      createdBy: adminUid,
      source: 'fuel-import',
      createdAt: serverTimestamp(),
    });
    created.push({ name: station.name, id: docRef.id });
    if (phoneKey) existingPhones.add(phoneKey);
  }

  // --- Leads: each gets a placeholder account so createdBy is a real uid ---
  for (const lead of leads) {
    const reasons = readiness(lead);
    if (reasons.length && !FORCE) {
      skipped.push({ name: lead.name, kind: 'lead', reasons });
      continue;
    }

    const phoneKey = typeof lead.phone === 'string' && lead.phone.trim() ? lead.phone.trim() : null;
    const emailKey = typeof lead.email === 'string' && lead.email.trim() ? lead.email.trim().toLowerCase() : null;
    if ((phoneKey && existingPhones.has(phoneKey)) || (emailKey && existingEmails.has(emailKey))) {
      skipped.push({ name: lead.name, kind: 'lead', reasons: ['already exists (phone/email match)'] });
      continue;
    }

    const dummyEmail = dummyEmailFor(slugify(lead.name), email);
    const dummyPassword = generatePassword();

    let uid;
    try {
      uid = (await createUserWithEmailAndPassword(auth, dummyEmail, dummyPassword)).user.uid;
    } catch (e) {
      skipped.push({ name: lead.name, kind: 'lead', reasons: [`account creation failed: ${e.message}`] });
      continue;
    }

    const { internal, ...publicData } = lead;
    const docRef = await addDoc(collection(db, 'mechanics'), {
      ...publicData,
      claimed: true,
      verified: false,
      createdBy: uid,
      source: 'pitch-import',
      createdAt: serverTimestamp(),
    });
    created.push({ name: lead.name, id: docRef.id });
    accounts.push({ name: lead.name, mechanicId: docRef.id, uid, email: dummyEmail, password: dummyPassword });
    if (phoneKey) existingPhones.add(phoneKey);
    if (emailKey) existingEmails.add(emailKey);

    // Sign out so the next createUserWithEmailAndPassword starts from scratch.
    await signOut(auth);
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
