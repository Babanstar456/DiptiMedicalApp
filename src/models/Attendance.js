const mongoose = require('mongoose');

const ATTENDANCE_STATUSES = ['present', 'absent', 'half-day', 'paid-leave', 'unpaid-leave', 'holiday'];

const attendanceSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    checkIn: String, // HH:mm
    checkOut: String,
    note: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

attendanceSchema.index({ staff: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
module.exports.ATTENDANCE_STATUSES = ATTENDANCE_STATUSES;
