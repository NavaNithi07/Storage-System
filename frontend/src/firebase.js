// Firebase configuration for Vibna Storage
// ──────────────────────────────────────────────────────────────────────────────
// ⚠️  TO ENABLE GOOGLE SIGN-IN:
//   1. Go to https://console.firebase.google.com
//   2. Create a project → Authentication → Enable Google sign-in method
//   3. Project Settings → General → Add Web app → copy config values
//   4. Paste your real values in frontend/.env  (see .env.example)
// ──────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const raw = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Detect placeholder or genuinely missing values
const isConfigured =
  raw.apiKey &&
  !raw.apiKey.startsWith('REPLACE_') &&
  raw.projectId &&
  !raw.projectId.startsWith('REPLACE_');

let auth = null;
let googleProvider = null;

if (isConfigured) {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(raw);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    if (typeof window !== 'undefined') {
      window.__VIBNA_FIREBASE_CONFIG__ = raw;
    }
  } catch (err) {
    console.error('[Firebase] Initialisation failed:', err.message);
  }
} else {
  console.warn(
    '[Firebase] Google Sign-In is NOT configured.\n' +
    'Add your real Firebase project values to frontend/.env\n' +
    'See frontend/.env.example for the required variable names.'
  );
}

export { auth, googleProvider };
export const firebaseConfigured = isConfigured && auth !== null;
