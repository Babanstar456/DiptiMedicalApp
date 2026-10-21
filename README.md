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
public/index.html              Login page (one "Continue" flow) + loading UI
public/home/index.html         Customer home (placeholder)
public/admin/index.html        Admin panel (dashboard, catalog, inventory, orders, clinic, HR, payroll)
src/routes/admin/              Admin API (role-protected)
public/css, public/js, public/img
```

## How login works
There is no separate "sign up". The login page has **Continue with Google** and an email/password **Continue** button:
an existing user is signed in; a new email gets an account created automatically (and a verification email).

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

## Admin panel (`/admin/`)
- **Who gets in:** emails in `ADMIN_EMAILS` (default `digital.diptimedical@gmail.com`) become **admin** on login, but only once
  Firebase has verified the email (Google sign-in is verified automatically), so nobody can claim the address with a password.
  Admins can make other users **Staff (pharmacist)** or **Admin** under *Users & access*.
- **Staff (pharmacist)** can use Dashboard, Orders, Products, Inventory, Categories, Types, Appointments and Doctors.
  **Admins** can also use Staff, Attendance, Payroll and Users.
- **Stock** only changes through *Inventory → Stock in/out* and through orders (sales deduct, cancellations return),
  so every change is logged in *Stock history*.
- **Images** are resized in the browser (max 1000px, WebP) and stored in MongoDB, so no extra storage service is needed.
- **Payroll rules:** gross = basic + allowances; per-day rate = gross ÷ days in month; unpaid days = absent + unpaid leave +
  ½ × half days (unmarked days count as paid); net = gross − absence deduction − fixed deductions − other deductions + bonus.
  *Generate payroll* builds draft payslips from attendance; paid payslips are never changed. Export the salary report as CSV or print it.

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

The GitHub Action in `.github/workflows/build-apk.yml` builds a debug APK that loads the Vercel site.
Email/password login works in it. **Google sign-in does not**: Google blocks its login page inside app WebViews.

With **Capacitor**, note that Google web popups/redirects don't work inside the native
WebView. Use `@capacitor-firebase/authentication` for native Google sign-in, then sign in the
Firebase web SDK with the returned credential — the backend needs no changes since it only checks the ID token.
