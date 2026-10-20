// One-off seed script: pushes ONLY the fuel stations in src/mockExtras.json
// into the live `mechanics` Firestore collection — a fuel-only split of
// seedLeads.mjs so re-running it can never touch mechanic/parts leads.
//
// All fuel stations share one generic staff account (gears-staff@gears-ghana.com).
// Idempotent-ish: skips a station if one with the same name already exists.
// Pass --force to publish incomplete entries anyway (shouldn't be needed —
// fuel stations only require name/area/lat/lng, no phone/email).
//
//   node seedFuelStations.mjs

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = {
  apiKey: 'AIzaSyBwUsHF7jo9MUfVVz42bdYPss0TK9M2Zog',
  authDomain: 'gears-c88f8.firebaseapp.com',
  projectId: 'gears-c88f8',
};

const FORCE = process.argv.includes('--force');
const STAFF_EMAIL = 'gears-staff@gears-ghana.com';
const STAFF_PASSWORD = 'Gears@2026';
const ADMIN_UID = 'JY9zFP6sgXP9euC58dGVVglKvpa2';

function isPlaceholder(value) {
  return typeof value !== 'string' || value.trim() === '' || value.includes('TODO');
}

function readiness(station) {
  const reasons = [];
  if (isPlaceholder(station.name)) reasons.push('name missing/placeholder');
  if (isPlaceholder(station.area)) reasons.push('area missing/placeholder');
  if (typeof station.lat !== 'number' || typeof station.lng !== 'number') reasons.push('lat/lng missing');
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
  const fuelStations = JSON.parse(readFileSync(new URL('./src/mockExtras.json', import.meta.url)))
    .filter((m) => m.specialty === 'Fuel Station');

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const existingNames = new Set();
  (await getDocs(collection(db, 'mechanics'))).forEach((d) => {
    const data = d.data();
    if (data.specialty === 'Fuel Station' && !isPlaceholder(data.name)) {
      existingNames.add(data.name.trim().toLowerCase());
    }
  });

  const staffUid = await getOrCreateAccountUid(auth, STAFF_EMAIL, STAFF_PASSWORD);

  const created = [];
  const skipped = [];

  for (const station of fuelStations) {
    const reasons = readiness(station);
    if (reasons.length && !FORCE) {
      skipped.push({ name: station.name, reasons });
      continue;
    }
    const nameKey = station.name.trim().toLowerCase();
    if (existingNames.has(nameKey)) {
      skipped.push({ name: station.name, reasons: ['already exists (name match)'] });
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
    existingNames.add(nameKey);
  }

  console.log(`\nCreated ${created.length} fuel station doc(s).`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length}:`);
    skipped.forEach((s) => console.log(`  ${s.name}: ${s.reasons.join('; ')}`));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
