// Re-exports the centralized Firebase initialization from src/firebase.js
// so anything importing from services/firebase gets the same singleton.
export { auth, googleProvider, firebaseConfigured } from '../firebase';
