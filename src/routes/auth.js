const router = require('express').Router();
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const User = require('../models/User');

// Called right after any Firebase sign-in (email or Google). Creates or updates the Mongo user.
router.post('/session', verifyFirebaseToken, async (req, res, next) => {
  try {
    const fb = req.firebaseUser;
    const requestedName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 100) : '';
    const provider = fb.firebase?.sign_in_provider;

    const update = {
      $set: {
        email: fb.email,
        emailVerified: !!fb.email_verified,
        lastLoginAt: new Date(),
      },
      $inc: { loginCount: 1 },
      $addToSet: { providers: provider },
    };
    const displayName = fb.name || requestedName;
    if (displayName) update.$set.displayName = displayName;
    if (fb.picture) update.$set.photoURL = fb.picture;
    if (fb.phone_number) update.$set.phoneNumber = fb.phone_number;

    const user = await User.findOneAndUpdate({ uid: fb.uid }, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    if (!user.isActive) return res.status(403).json({ error: 'This account has been disabled' });

    res.json({ user: user.toPublic(), isNewUser: user.loginCount === 1 });
  } catch (err) {
    next(err);
  }
});

router.get('/me', verifyFirebaseToken, async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.firebaseUser.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
