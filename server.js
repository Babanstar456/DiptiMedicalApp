require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Lists required settings that are missing (names only, never values).
function missingEnv() {
  const env = process.env;
  const isSet = (k) => env[k] && !/xxxxx|PASTE_KEY_HERE|your-project|<user>/.test(env[k]);
  const missing = ['MONGODB_URI', 'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID'].filter(
    (k) => !isSet(k)
  );
  const keyFile = env.FIREBASE_SERVICE_ACCOUNT_PATH && path.resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH);
  const hasKeyFile = keyFile && fs.existsSync(keyFile);
  const hasKeyJson = isSet('FIREBASE_SERVICE_ACCOUNT') && env.FIREBASE_SERVICE_ACCOUNT.includes('private_key');
  const hasKeyVars = isSet('FIREBASE_CLIENT_EMAIL') && isSet('FIREBASE_PRIVATE_KEY');
  if (!hasKeyJson && !hasKeyFile && !hasKeyVars) missing.push('FIREBASE_SERVICE_ACCOUNT');
  return missing;
}
const missing = missingEnv();
if (missing.length) console.error('[setup] Missing environment variables: ' + missing.join(', '));

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
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
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
app.use('/api/admin/uploads', express.json({ limit: '3mb' })); // base64 images
app.use(express.json({ limit: '200kb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

app.get('/api/health', (req, res) =>
  res.status(missing.length ? 500 : 200).json({ status: missing.length ? 'misconfigured' : 'ok', missing })
);

// Every API needs configuration; report what's missing instead of crashing.
app.use('/api', (req, res, next) => {
  if (!missing.length) return next();
  res.status(500).json({ error: 'Server is not configured', missing });
});

const withDB = (req, res, next) => connectDB().then(() => next(), next);

app.use('/api/config', require('./src/routes/config'));
app.use(
  '/api/auth',
  withDB,
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }),
  require('./src/routes/auth')
);
app.use('/api/admin', withDB, require('./src/routes/admin'));
app.use('/api/images', withDB, require('./src/routes/images'));

// Locally Express serves public/; on Vercel the same folder is served by its CDN.
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '1h' : 0 }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((req, res) => res.redirect('/'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (/ServerSelection|MongoNetwork|MongoTimeout/.test(err.name)) {
    return res.status(503).json({ error: 'Database connection failed. Check MONGODB_URI and Atlas Network Access.' });
  }
  if (/FIREBASE_|Firebase Admin/.test(err.message)) {
    return res.status(500).json({ error: err.message });
  }
  if (err.expose) return res.status(err.status || 400).json({ error: err.message });
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join('. ') });
  }
  if (err.name === 'CastError') return res.status(400).json({ error: `Invalid value for ${err.path}` });
  if (err.code === 11000) {
    return res.status(409).json({ error: `That ${Object.keys(err.keyValue || {})[0] || 'value'} already exists` });
  }
  res.status(err.status || 500).json({ error: isProd ? 'Something went wrong' : err.message });
});

module.exports = app;

// `npm start` / `npm run dev`: run a normal server. On Vercel the exported app is used instead.
if (require.main === module) {
  if (missing.length) {
    console.error('\nThe app is not configured yet. Add these to .env:\n  - ' + missing.join('\n  - '));
    console.error('\nSee README.md → Setup for where to get each value.\n');
    process.exit(1);
  }
  connectDB()
    .then(() => app.listen(PORT, () => console.log(`[server] Dipti Medical running on http://localhost:${PORT}`)))
    .catch((err) => {
      console.error('[server] Failed to start:', err.message);
      process.exit(1);
    });
}
