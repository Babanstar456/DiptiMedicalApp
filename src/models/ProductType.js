const mongoose = require('mongoose');

// Dosage form / product type: Tablet, Capsule, Syrup, Injection, Ointment, Device…
const productTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60, unique: true },
    unit: { type: String, trim: true, maxlength: 20, default: 'pcs' }, // strip, bottle, tube, pcs
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProductType', productTypeSchema);
