import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const config = {
  apiKey: "AIzaSyBwUsHF7jo9MUfVVz42bdYPss0TK9M2Zog",
  authDomain: "gears-c88f8.firebaseapp.com",
  projectId: "gears-c88f8",
  storageBucket: "gears-c88f8.firebasestorage.app",
  messagingSenderId: "103907073176",
  appId: "1:103907073176:web:410b4b33bd8ffbcd3584ed",
  measurementId: "G-4SRRQCBFTX",
};

const app = initializeApp(config);
const db = getFirestore(app);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log("Fetching mechanics...");
  const snap = await getDocs(collection(db, 'mechanics'));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log(`Found ${docs.length} mechanics.`);
  let updated = 0;

  for (const m of docs) {
    if (!m.lat || !m.lng || (m.lat === 5.6037 && m.lng === -0.1870)) {
      console.log(`Geocoding ${m.name} in ${m.area}...`);
      const q = encodeURIComponent(`${m.name} ${m.area} Ghana`);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
          headers: {
            'User-Agent': 'GearsApp/1.0 (contact@gears.com)'
          }
        });
        const data = await res.json();
        
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          await updateDoc(doc(db, 'mechanics', m.id), { lat, lng });
          console.log(`Updated ${m.name}: ${lat}, ${lng}`);
          updated++;
        } else {
          // Fallback just to area
          const q2 = encodeURIComponent(`${m.area} Ghana`);
          const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q2}&limit=1`, {
            headers: {
              'User-Agent': 'GearsApp/1.0 (contact@gears.com)'
            }
          });
          const data2 = await res2.json();
          if (data2 && data2.length > 0) {
            const lat = parseFloat(data2[0].lat);
            const lng = parseFloat(data2[0].lon);
            await updateDoc(doc(db, 'mechanics', m.id), { lat, lng });
            console.log(`Updated ${m.name} (fallback): ${lat}, ${lng}`);
            updated++;
          } else {
             console.log(`Could not find location for ${m.name}`);
          }
        }
      } catch(e) {
        console.error(`Error geocoding ${m.name}:`, e.message);
      }
      
      // Respect Nominatim's 1 req/sec policy
      await sleep(1500); 
    }
  }
  
  console.log(`Finished. Updated ${updated} mechanics.`);
  process.exit(0);
}

run();
