const admin = require('../config/firebaseAdmin');

// Expects "Authorization: Bearer <Firebase ID token>" — works the same for web and the future mobile app.
async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    req.firebaseUser = await admin.auth().verifyIdToken(token, true);
    next();
  } catch (err) {
    const expired = err.code === 'auth/id-token-expired';
    res.status(401).json({ error: expired ? 'Session expired, please sign in again' : 'Invalid auth token' });
  }
}

module.exports = verifyFirebaseToken;
