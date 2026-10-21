const r = require('express').Router();
const User = require('../../models/User');
const { escapeRegex } = require('../../utils/crud');
const { isAdminEmail } = require('../../utils/admins');
const { httpError } = require('./stock');

r.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const query = {};
    if (req.query.role) query.role = req.query.role;
    if (req.query.q) {
      const re = new RegExp(escapeRegex(req.query.q.trim()), 'i');
      query.$or = [{ email: re }, { displayName: re }, { phoneNumber: re }];
    }
    const [items, total] = await Promise.all([
      User.find(query).sort('-lastLoginAt').skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(query),
    ]);
    res.json({ items: items.map((u) => ({ ...u, isOwner: isAdminEmail(u.email) })), total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id { role, isActive }
r.patch('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw httpError(404, 'User not found');
    if (String(user._id) === String(req.user._id)) throw httpError(400, 'You cannot change your own access');
    if (isAdminEmail(user.email)) throw httpError(400, 'The owner account always keeps admin access');

    const { role, isActive } = req.body || {};
    if (role !== undefined) {
      if (!['customer', 'pharmacist', 'admin'].includes(role)) throw httpError(400, 'Invalid role');
      user.role = role;
    }
    if (isActive !== undefined) user.isActive = !!isActive;
    await user.save();
    res.json(user.toPublic());
  } catch (err) {
    next(err);
  }
});

module.exports = r;
