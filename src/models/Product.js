const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    sku: { type: String, trim: true, uppercase: true, maxlength: 40, unique: true, sparse: true },
    barcode: { type: String, trim: true, maxlength: 60 },
    category: { type: ObjectId, ref: 'Category' },
    type: { type: ObjectId, ref: 'ProductType' },
    manufacturer: { type: String, trim: true, maxlength: 120 },
    composition: { type: String, trim: true, maxlength: 300 }, // salt / generic name
    strength: { type: String, trim: true, maxlength: 60 }, // e.g. 500 mg
    packSize: { type: String, trim: true, maxlength: 60 }, // e.g. 10 tablets
    description: { type: String, trim: true, maxlength: 2000 },
    images: [String],
    mrp: { type: Number, min: 0, default: 0 },
    price: { type: Number, min: 0, default: 0 }, // selling price; 0 = not set yet
    gstRate: { type: Number, min: 0, max: 28, default: 12 },
    inStock: { type: Boolean, default: true, index: true },
    rackLocation: { type: String, trim: true, maxlength: 40 },
    supplier: { type: String, trim: true, maxlength: 120 },
    prescriptionRequired: { type: Boolean, default: false },
    featured: { type: Boolean, default: false, index: true }, // shown in the shop's Bestsellers carousel
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 1 });

module.exports = mongoose.model('Product', productSchema);
