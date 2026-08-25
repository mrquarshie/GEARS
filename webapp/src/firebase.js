import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseReady = Boolean(config.apiKey && config.projectId && config.appId);

const app = firebaseReady ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Explicit rather than relying on the SDK's implicit default — without this,
// some environments (Safari ITP, private browsing, sandboxed iframes) fall
// back to in-memory persistence, which is what was forcing a fresh sign-in
// on every launch instead of staying signed in like a normal web app.
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Storage genuinely unavailable — user will just need to sign in each visit.
  });
}

// Analytics is only supported in browser environments (not SSR/Node)
if (app) {
  isSupported().then((supported) => {
    if (supported) getAnalytics(app);
  });
}
