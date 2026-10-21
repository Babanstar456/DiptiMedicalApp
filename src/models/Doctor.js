const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    specialization: { type: String, trim: true, maxlength: 100 },
    qualification: { type: String, trim: true, maxlength: 150 },
    registrationNo: { type: String, trim: true, maxlength: 60 },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    photo: String,
    fee: { type: Number, min: 0, default: 0 },
    days: [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
    startTime: { type: String, default: '10:00' }, // HH:mm
    endTime: { type: String, default: '13:00' },
    slotMinutes: { type: Number, min: 5, max: 120, default: 15 },
    bio: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
