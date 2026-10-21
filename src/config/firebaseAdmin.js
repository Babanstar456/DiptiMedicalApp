const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Accepts the key with real line breaks or with literal "\n", with or without wrapping quotes.
function normalizePrivateKey(raw) {
  return raw.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
}

function loadCredential() {
  // Whole service-account JSON pasted into .env (single-line or multi-line inside single quotes)
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim()) {
    let json;
    try {
      json = JSON.parse(raw.trim());
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the entire key file wrapped in single quotes: FIREBASE_SERVICE_ACCOUNT='{ ... }'"
      );
    }
    if (json.type !== 'service_account' || !json.private_key || !json.client_email) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT does not look like a Firebase service-account key.');
    }
    json.private_key = normalizePrivateKey(json.private_key);
    return admin.credential.cert(json);
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    const privateKey = normalizePrivateKey(FIREBASE_PRIVATE_KEY);
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error('FIREBASE_PRIVATE_KEY does not look like a valid private key. Run: npm run key-to-env -- path/to/key.json');
    }
    return admin.credential.cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey });
  }

  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (keyPath && fs.existsSync(path.resolve(keyPath))) {
    const json = JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf8'));
    return admin.credential.cert(json);
  }

  throw new Error(
    'Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_PATH or ' +
      'FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in .env'
  );
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: loadCredential() });
}

module.exports = admin;
