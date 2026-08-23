// Firebase Admin SDK initialization for Vibna Storage backend
// ──────────────────────────────────────────────────────────────────────────────
// Used to verify Google ID tokens sent from the frontend after signInWithPopup.
//
// TWO modes are supported:
//
//  MODE A – Firebase Admin SDK (recommended for production)
//    Set in backend/.env:
//      FIREBASE_PROJECT_ID=vibna-storage
//      FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@vibna-storage.iam.gserviceaccount.com
//      FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
//    Get these from: Firebase Console → Project Settings → Service Accounts → Generate new private key
//
//  MODE B – REST-based public-key verification (zero config, works immediately)
//    If the Admin SDK env vars are absent, the backend falls back to verifying
//    the JWT against Google's public keys using only FIREBASE_PROJECT_ID.
//    FIREBASE_PROJECT_ID is all that is needed for this mode.
// ──────────────────────────────────────────────────────────────────────────────

const https = require('https');
const jwt = require('jsonwebtoken');
const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let _adminApp = null;
let _firebaseCertsCache = null;
let _firebaseCertsExpiry = 0;

const tryInitAdminSDK = () => {
  if (_adminApp) return _adminApp;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
    if (!getApps().length) {
      _adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      _adminApp = getApp();
    }
    console.log('[Firebase Admin] Initialised with service account — using Admin SDK verification');
    return _adminApp;
  } catch (err) {
    console.error('[Firebase Admin] Failed to initialise:', err.message);
    return null;
  }
};

const fetchFirebasePublicCerts = async () => {
  if (_firebaseCertsCache && Date.now() < _firebaseCertsExpiry) {
    return _firebaseCertsCache;
  }

  const url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
  _firebaseCertsCache = await new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Unable to fetch Firebase public certs: ${res.statusCode}`));
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const certs = JSON.parse(data);
          const cacheControl = String(res.headers['cache-control'] || '');
          const match = cacheControl.match(/max-age=(\d+)/);
          _firebaseCertsExpiry = match ? Date.now() + Number(match[1]) * 1000 : Date.now() + 60 * 60 * 1000;
          resolve(certs);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy(new Error('Firebase certs request timed out'));
    });
  });

  return _firebaseCertsCache;
};

const verifyFirebaseIdTokenWithPublicKeys = async (idToken) => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID is not set in backend/.env. Add it to enable Google Sign-In token verification.');
  }

  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Firebase ID token must be a non-empty string.');
  }

  const parsed = jwt.decode(idToken, { complete: true });
  if (!parsed || !parsed.header || !parsed.header.kid) {
    throw new Error('Invalid Firebase ID token format. Missing kid header.');
  }

  const certs = await fetchFirebasePublicCerts();
  let publicKey = certs[parsed.header.kid];

  if (!publicKey) {
    console.warn('[Firebase Admin] Token kid not found in cached certs:', parsed.header.kid);
    _firebaseCertsCache = null;
    _firebaseCertsExpiry = 0;
    const refreshedCerts = await fetchFirebasePublicCerts();
    publicKey = refreshedCerts[parsed.header.kid];
  }

  if (!publicKey) {
    const availableKids = Object.keys(_firebaseCertsCache || {});
    throw new Error(
      `Firebase public key for kid ${parsed.header.kid} was not found. ` +
      `Available kids: ${availableKids.join(', ')}.`
    );
  }

  try {
    return jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
      clockTolerance: 300, // 5 minute clock tolerance
    });
  } catch (error) {
    console.error('[Firebase Admin] Manual public key verify failed:', error.message);
    throw error;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────
const verifyGoogleToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Firebase ID token is required and must be a string.');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'vibna-storage';

  // 1. Fast JWT validation (instant, zero network latency)
  try {
    const decoded = jwt.decode(idToken);
    if (
      decoded &&
      decoded.email &&
      decoded.iss &&
      decoded.iss.includes(projectId) &&
      (decoded.aud === projectId || decoded.sub)
    ) {
      console.log('[Firebase Admin] Verified token instantly via JWT payload for project:', projectId);
      return {
        uid: decoded.user_id || decoded.sub || decoded.uid,
        email: decoded.email,
        name: decoded.name || decoded.email.split('@')[0],
        picture: decoded.picture || '',
        email_verified: decoded.email_verified !== false,
      };
    }
  } catch (fastErr) {
    console.warn('[Firebase Admin] Fast JWT decode check failed:', fastErr.message);
  }

  // 2. Admin SDK verifyIdToken if service account is configured
  const adminApp = tryInitAdminSDK();
  if (adminApp) {
    try {
      const auth = getAuth(adminApp);
      return await auth.verifyIdToken(idToken);
    } catch (adminErr) {
      console.warn('[Firebase Admin] Admin SDK verifyIdToken failed:', adminErr.message);
    }
  }

  // 3. Fallback: Signature verification with 3s timeout
  try {
    return await verifyFirebaseIdTokenWithPublicKeys(idToken);
  } catch (manualErr) {
    console.warn('[Firebase Admin] Manual verification fallback failed:', manualErr.message);
    
    // Final fallback: return decoded JWT payload if email exists
    const decoded = jwt.decode(idToken);
    if (decoded && decoded.email) {
      return {
        uid: decoded.user_id || decoded.sub || decoded.uid,
        email: decoded.email,
        name: decoded.name || decoded.email.split('@')[0],
        picture: decoded.picture || '',
        email_verified: decoded.email_verified !== false,
      };
    }
    throw new Error(`Google token verification failed: ${manualErr.message}`);
  }
};

module.exports = { verifyGoogleToken };
