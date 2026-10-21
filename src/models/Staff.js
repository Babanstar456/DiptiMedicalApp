const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    employeeId: { type: String, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    designation: { type: String, trim: true, maxlength: 80 }, // Pharmacist, Cashier, Delivery…
    department: { type: String, enum: ['Pharmacy', 'Clinic', 'Delivery', 'Accounts', 'Other'], default: 'Pharmacy' },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 300 },
    photo: String,
    joiningDate: Date,
    baseSalary: { type: Number, min: 0, default: 0 }, // per month
    allowances: { type: Number, min: 0, default: 0 }, // HRA, travel etc. per month
    fixedDeductions: { type: Number, min: 0, default: 0 }, // PF, ESI, PT etc. per month
    bankName: { type: String, trim: true, maxlength: 80 },
    accountNo: { type: String, trim: true, maxlength: 30 },
    ifsc: { type: String, trim: true, uppercase: true, maxlength: 15 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Staff', staffSchema);
