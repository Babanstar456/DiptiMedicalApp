const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const ORDER_STATUSES = ['awaiting-payment', 'pending', 'confirmed', 'packed', 'out-for-delivery', 'delivered', 'cancelled'];

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, unique: true },
    channel: { type: String, enum: ['counter', 'online', 'phone'], default: 'counter' },
    user: { type: ObjectId, ref: 'User' },
    customer: {
      name: { type: String, trim: true, maxlength: 100 },
      phone: { type: String, trim: true, maxlength: 20 },
      address: { type: String, trim: true, maxlength: 400 },
      pincode: { type: String, trim: true, maxlength: 10 },
    },
    items: [
      {
        product: { type: ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        quantity: { type: Number, min: 1 },
        gstRate: Number,
        total: Number,
      },
    ],
    subtotal: Number,
    discount: { type: Number, min: 0, default: 0 },
    tax: Number, // GST included in prices; shown for the invoice
    total: Number,
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'cod', 'online'], default: 'cash' },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'paid' },
    status: { type: String, enum: ORDER_STATUSES, default: 'confirmed', index: true },
    prescriptionImage: String,
    payment: {
      razorpayOrderId: { type: String, index: true, sparse: true },
      razorpayPaymentId: String,
      paidAt: Date,
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    history: [{ status: String, at: { type: Date, default: Date.now }, by: { type: ObjectId, ref: 'User' } }],
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
