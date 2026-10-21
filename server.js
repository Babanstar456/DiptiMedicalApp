require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Fail early with a readable checklist instead of a stack trace when setup is incomplete.
(function checkEnv() {
  const env = process.env;
  const isSet = (k) => env[k] && !/xxxxx|PASTE_KEY_HERE|your-project|<user>/.test(env[k]);
  const missing = [];
  if (!fs.existsSync(path.join(__dirname, '.env'))) missing.push('.env file (copy .env.example to .env)');
  ['MONGODB_URI', 'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID'].forEach(
    (k) => !isSet(k) && missing.push(k)
  );
  const keyFile = env.FIREBASE_SERVICE_ACCOUNT_PATH && path.resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH);
  const hasKeyFile = keyFile && fs.existsSync(keyFile);
  const hasKeyJson = isSet('FIREBASE_SERVICE_ACCOUNT') && env.FIREBASE_SERVICE_ACCOUNT.includes('private_key');
  const hasKeyVars = isSet('FIREBASE_CLIENT_EMAIL') && isSet('FIREBASE_PRIVATE_KEY');
  if (!hasKeyJson && !hasKeyFile && !hasKeyVars) {
    missing.push("FIREBASE_SERVICE_ACCOUNT (paste the whole service-account JSON inside single quotes)");
  }
  if (missing.length) {
    console.error('\n[setup] The app is not configured yet. Missing:\n  - ' + missing.join('\n  - '));
    console.error('\nSee README.md → Setup for where to get each value.\n');
    process.exit(1);
  }
})();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (isProd) app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://www.gstatic.com', 'https://apis.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.firebaseio.com', 'https://www.gstatic.com'],
        frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://*.web.app', 'https://accounts.google.com'],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    // Required so Firebase signInWithPopup can talk back to this window
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

app.use('/api/config', require('./src/routes/config'));
app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }),
  require('./src/routes/auth')
);
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: isProd ? '1h' : 0 }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: isProd ? 'Something went wrong' : err.message });
});

connectDB(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`[server] Dipti Medical running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('[server] Failed to start:', err.message);
    process.exit(1);
  });
