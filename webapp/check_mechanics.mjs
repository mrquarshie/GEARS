import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const config = {
  apiKey: "AIzaSyBwUsHF7jo9MUfVVz42bdYPss0TK9M2Zog",
  authDomain: "gears-c88f8.firebaseapp.com",
  projectId: "gears-c88f8"
};

const app = initializeApp(config);
const db = getFirestore(app);

async function check() {
  console.log("Checking Firestore...");
  try {
    const snap = await getDocs(collection(db, 'mechanics'));
    console.log(`Found ${snap.size} mechanics in database.`);
  } catch(e) {
    console.error("Error reading db:", e.message);
  }
  process.exit(0);
}

check();
