const verifyFirebaseToken = require('./verifyFirebaseToken');
const User = require('../models/User');

// Any signed-in person (customer, staff or admin). Creates the profile if login never synced it.
module.exports = [
  verifyFirebaseToken,
  async (req, res, next) => {
    try {
      const fb = req.firebaseUser;
      let user = await User.findOne({ uid: fb.uid });
      if (!user) {
        user = await User.create({
          uid: fb.uid,
          email: fb.email,
          displayName: fb.name,
          photoURL: fb.picture,
          emailVerified: !!fb.email_verified,
          providers: [fb.firebase?.sign_in_provider].filter(Boolean),
        });
      }
      if (!user.isActive) return res.status(403).json({ error: 'This account has been disabled. Please contact the pharmacy.' });
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  },
];
