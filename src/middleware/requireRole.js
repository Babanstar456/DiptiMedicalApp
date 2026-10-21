const verifyFirebaseToken = require('./verifyFirebaseToken');
const User = require('../models/User');

// Verifies the Firebase token, loads the Mongo user and checks their role.
function requireRole(...roles) {
  return [
    verifyFirebaseToken,
    async (req, res, next) => {
      try {
        const user = await User.findOne({ uid: req.firebaseUser.uid });
        if (!user || !user.isActive) return res.status(403).json({ error: 'Account not found or disabled' });
        if (!roles.includes(user.role)) return res.status(403).json({ error: 'You do not have access to this section' });
        req.user = user;
        next();
      } catch (err) {
        next(err);
      }
    },
  ];
}

module.exports = requireRole;
