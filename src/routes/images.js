const r = require('express').Router();
const Image = require('../models/Image');
const { isId } = require('../utils/crud');

// Public: product / doctor / category images. Images never change, so cache them for a year.
r.get('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).end();
    const img = await Image.findById(req.params.id).lean();
    if (!img) return res.status(404).end();
    res.set({ 'Content-Type': img.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.send(img.data.buffer ? Buffer.from(img.data.buffer) : img.data);
  } catch (err) {
    next(err);
  }
});

module.exports = r;
