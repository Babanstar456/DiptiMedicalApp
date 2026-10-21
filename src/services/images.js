const Image = require('../models/Image');
const httpError = require('../utils/httpError');

const MAX_BYTES = 1.5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// data: "data:image/webp;base64,...." — images are resized in the browser before upload.
async function saveImage(data, userId, { isPrivate = false } = {}) {
  const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(data || '');
  if (!m || !TYPES.includes(m[1])) throw httpError(400, 'Upload a JPG, PNG or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw httpError(413, 'Image is too large (max 1.5 MB after resizing)');
  return Image.create({ data: buf, contentType: m[1], size: buf.length, uploadedBy: userId, private: isPrivate });
}

function sendImage(res, img, cache = 'public, max-age=31536000, immutable') {
  res.set({ 'Content-Type': img.contentType, 'Cache-Control': cache });
  res.send(img.data.buffer ? Buffer.from(img.data.buffer) : img.data);
}

module.exports = { saveImage, sendImage };
