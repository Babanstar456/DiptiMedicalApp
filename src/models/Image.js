const mongoose = require('mongoose');

// Small, client-resized images stored in MongoDB (works on Vercel, no extra storage service).
const imageSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Prescriptions are private: only the uploader and pharmacy staff can open them, never via the public URL.
    private: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Image', imageSchema);
