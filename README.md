# Dipti Medical – App

Node.js (Express) + Firebase Authentication (Email, Google) + MongoDB Atlas.
The UI is mobile-first and plain HTML/CSS/JS, so it can be wrapped as an Android/iOS app (e.g. Capacitor) later.

## Project structure
```
server.js                      Express app (security headers, API, static files)
src/config/db.js               MongoDB Atlas connection (Mongoose)
src/config/firebaseAdmin.js    Firebase Admin SDK (verifies ID tokens)
src/middleware/verifyFirebaseToken.js
src/models/User.js             User collection
src/routes/auth.js             POST /api/auth/session, GET /api/auth/me
src/routes/config.js           GET /api/config/firebase (public web config)
public/index.html              Login / sign-up page + loading UI
public/home.html               Post-login page (placeholder)
public/css, public/js, public/img
```

## How login works
1. User signs in on the client with Firebase (email/password or Google).
2. The client sends the Firebase **ID token** to `POST /api/auth/session` as `Authorization: Bearer <token>`.
3. The server verifies it with Firebase Admin and creates/updates the user in MongoDB.
4. Every protected API call sends the same Bearer token — this works identically from the future mobile app.

## Setup

### 1. Install
```bash
npm install
cp .env.example .env
```

### 2. MongoDB Atlas
1. Create a free cluster at https://cloud.mongodb.com
2. **Database Access** → add a database user.
3. **Network Access** → add your IP (or `0.0.0.0/0` for testing).
4. **Connect → Drivers** → copy the URI into `MONGODB_URI` (put `dipti_medical` as the DB name).

### 3. Firebase
1. Create a project at https://console.firebase.google.com and add a **Web app**. Copy its config values into `.env`.
2. **Authentication → Sign-in method** → enable:
   - **Email/Password**
   - **Google**
3. **Authentication → Settings → Authorized domains** → add your production domain (`localhost` is there by default).
4. **Project settings → Service accounts → Generate new private key** (downloads a JSON file).
   Open it, copy everything, and paste it into `.env` between single quotes:
   ```
   FIREBASE_SERVICE_ACCOUNT='{
     "type": "service_account",
     ...
   }'
   ```
   Multi-line paste is fine. Use single quotes, not double quotes. Then delete the downloaded file.
   Prefer a one-line value (e.g. for Render/Railway dashboards)? Run `npm run key-to-env -- path/to/key.json`.

### 4. Run
```bash
npm run dev     # auto-restart on changes
# or
npm start
```
Open http://localhost:3000 — to test on your phone, open `http://<your-PC-LAN-IP>:3000`
(and add that IP to Firebase *Authorized domains*).

## Deploying to Vercel
`server.js` exports the Express app, so Vercel runs it as a serverless function and serves `public/` from its CDN.

1. **Vercel → Project → Settings → Environment Variables**: add every variable from `.env`
   (`MONGODB_URI`, all `FIREBASE_*`, and `FIREBASE_SERVICE_ACCOUNT`). For `FIREBASE_SERVICE_ACCOUNT`,
   paste the JSON itself. The surrounding single quotes are optional there. Then **redeploy**.
2. **MongoDB Atlas → Network Access**: add `0.0.0.0/0`. Vercel uses changing IP addresses.
3. **Firebase → Authentication → Settings → Authorized domains**: add your `*.vercel.app` domain.
4. Open `https://<your-app>.vercel.app/api/health`. It shows `"status":"ok"`, or lists the variables that are still missing.

## Turning it into a mobile app
The pages are already responsive (safe-area insets for notches, 16px inputs to avoid iOS zoom,
48px+ touch targets, landscape and tiny-screen layouts, PWA manifest).

With **Capacitor**, note that Google web popups/redirects don't work inside the native
WebView. Use `@capacitor-firebase/authentication` for native Google sign-in, then sign in the
Firebase web SDK with the returned credential — the backend needs no changes since it only checks the ID token.
