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
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'],
      default: 'confirmed',
    },
    fee: { type: Number, min: 0, default: 0 },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

appointmentSchema.index({ doctor: 1, date: 1, time: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
