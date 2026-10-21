const r = require('express').Router();
const Image = require('../../models/Image');
const { saveImage, sendImage } = require('../../services/images');
const { isId } = require('../../utils/crud');

// Body: { data: "data:image/webp;base64,...." }
r.post('/', async (req, res, next) => {
  try {
    const img = await saveImage(req.body?.data, req.user._id);
    res.status(201).json({ id: img._id, url: `/api/images/${img._id}` });
  } catch (err) {
    next(err);
  }
});

// Private images (prescriptions) for pharmacy staff
r.get('/private/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).end();
    const img = await Image.findById(req.params.id).lean();
    if (!img) return res.status(404).end();
    sendImage(res, img, 'private, no-store');
  } catch (err) {
    next(err);
  }
});

module.exports = r;
