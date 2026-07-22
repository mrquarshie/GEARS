import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBwUsHF7jo9MUfVVz42bdYPss0TK9M2Zog",
  authDomain: "gears-c88f8.firebaseapp.com",
  projectId: "gears-c88f8",
  storageBucket: "gears-c88f8.firebasestorage.app",
  messagingSenderId: "103907073176",
  appId: "1:103907073176:web:410b4b33bd8ffbcd3584ed",
  measurementId: "G-4SRRQCBFTX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteDuplicates() {
  console.log("Fetching mechanics to find duplicates...");
  const mechanicsRef = collection(db, 'mechanics');
  const snapshot = await getDocs(mechanicsRef);
  
  const mechanics = [];
  snapshot.forEach(doc => {
    mechanics.push({ id: doc.id, ...doc.data() });
  });

  console.log(`Found ${mechanics.length} total mechanics.`);

  // Group by a unique key (e.g. name + area + phone)
  const uniqueKeys = new Set();
  const duplicates = [];

  for (const m of mechanics) {
    // Some basic normalization
    const name = m.name ? m.name.trim().toLowerCase() : '';
    const area = m.area ? m.area.trim().toLowerCase() : '';
    const phone = m.phone ? m.phone.trim().replace(/\s+/g, '') : '';
    
    // Create a key to identify exact matches. You could relax it if you only want to match name & area.
    const key = `${name}|${area}`;

    if (uniqueKeys.has(key)) {
      duplicates.push(m);
    } else {
      uniqueKeys.add(key);
    }
  }

  console.log(`Found ${duplicates.length} duplicates to delete.`);

  let deletedCount = 0;
  for (const dup of duplicates) {
    try {
      await deleteDoc(doc(db, 'mechanics', dup.id));
      deletedCount++;
      console.log(`Deleted duplicate: ${dup.name} in ${dup.area}`);
    } catch (e) {
      console.error(`Failed to delete ${dup.id}:`, e);
    }
  }

  console.log(`Successfully deleted ${deletedCount} duplicates. Done!`);
  process.exit(0);
}

deleteDuplicates().catch(console.error);
