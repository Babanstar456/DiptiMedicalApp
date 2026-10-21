const r = require('express').Router();
const Image = require('../../models/Image');

const MAX_BYTES = 1.5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Body: { data: "data:image/webp;base64,...." } — images are resized in the browser before upload.
r.post('/', async (req, res, next) => {
  try {
    const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.data || '');
    if (!m || !TYPES.includes(m[1])) return res.status(400).json({ error: 'Upload a JPG, PNG or WebP image' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'Image is too large (max 1.5 MB after resizing)' });

    const img = await Image.create({ data: buf, contentType: m[1], size: buf.length, uploadedBy: req.user._id });
    res.status(201).json({ id: img._id, url: `/api/images/${img._id}` });
  } catch (err) {
    next(err);
  }
});

module.exports = r;
