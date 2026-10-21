const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: ObjectId, ref: 'Product', required: true, index: true },
    type: { type: String, enum: ['purchase', 'sale', 'return', 'adjustment', 'damage', 'expired'], required: true },
    quantity: { type: Number, required: true }, // + adds stock, − removes stock
    balanceAfter: Number,
    batchNo: String,
    expiryDate: Date,
    unitCost: Number,
    supplier: { type: String, trim: true, maxlength: 120 },
    reference: String, // e.g. order number / invoice number
    note: { type: String, trim: true, maxlength: 300 },
    by: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockMovement', stockMovementSchema);
