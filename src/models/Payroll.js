const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ }, // YYYY-MM
    daysInMonth: Number,
    present: Number,
    halfDay: Number,
    paidLeave: Number,
    unpaidLeave: Number,
    absent: Number,
    holiday: Number,
    unmarked: Number,
    baseSalary: Number,
    allowances: Number,
    grossSalary: Number,
    absenceDeduction: Number,
    fixedDeductions: Number,
    bonus: { type: Number, min: 0, default: 0 },
    otherDeductions: { type: Number, min: 0, default: 0 }, // advances etc.
    netPay: Number,
    status: { type: String, enum: ['draft', 'paid'], default: 'draft' },
    paidOn: Date,
    paymentMethod: { type: String, enum: ['', 'cash', 'bank', 'upi'], default: '' },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

payrollSchema.index({ staff: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
