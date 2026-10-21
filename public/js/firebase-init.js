// Shared Firebase client setup. Config comes from the server (/api/config/firebase) so nothing is hard-coded.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

const res = await fetch('/api/config/firebase');
if (!res.ok) throw new Error('Could not load app configuration');
const config = await res.json();
if (!config.apiKey) throw new Error('Firebase is not configured on the server (.env)');

export const app = initializeApp(config);
export const auth = getAuth(app);
auth.useDeviceLanguage();
await setPersistence(auth, browserLocalPersistence);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Authenticated call to our Node API using the current Firebase ID token.
export async function api(path, { method = 'GET', body, user = auth.currentUser } = {}) {
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  const r = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || `Request failed (${r.status})`), { status: r.status });
  return data;
}
