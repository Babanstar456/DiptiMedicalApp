const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const appointmentSchema = new mongoose.Schema(
  {
    appointmentNo: { type: String, unique: true },
    doctor: { type: ObjectId, ref: 'Doctor', required: true, index: true },
    user: { type: ObjectId, ref: 'User' },
    patientName: { type: String, required: true, trim: true, maxlength: 100 },
    patientPhone: { type: String, required: true, trim: true, maxlength: 20 },
    patientAge: { type: Number, min: 0, max: 130 },
    patientGender: { type: String, enum: ['', 'Male', 'Female', 'Other'], default: '' },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true }, // YYYY-MM-DD
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    reason: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['awaiting-payment', 'pending', 'confirmed', 'completed', 'cancelled', 'no-show'],
      default: 'confirmed',
    },
    fee: { type: Number, min: 0, default: 0 },
    // token-paid = online booking token received; the rest is collected at the clinic
    paymentStatus: { type: String, enum: ['unpaid', 'token-paid', 'paid', 'refunded'], default: 'unpaid' },
    tokenAmount: { type: Number, min: 0, default: 0 },
    channel: { type: String, enum: ['desk', 'online'], default: 'desk' },
    payment: {
      razorpayOrderId: { type: String, index: true, sparse: true },
      razorpayPaymentId: String,
      paidAt: Date,
    },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

appointmentSchema.index({ doctor: 1, date: 1, time: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
