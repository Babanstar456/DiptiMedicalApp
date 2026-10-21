const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true, index: true }, // Firebase UID
    email: { type: String, lowercase: true, trim: true, index: true, sparse: true },
    displayName: { type: String, trim: true, maxlength: 100 },
    photoURL: String,
    phoneNumber: String,
    providers: [{ type: String }], // e.g. password, google.com
    emailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['customer', 'pharmacist', 'admin'], default: 'customer' },
    isActive: { type: Boolean, default: true },
    dob: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD; age is calculated from it
    gender: { type: String, enum: ['', 'Male', 'Female', 'Other'], default: '' },
    healthConditions: [{ type: String, trim: true, maxlength: 40 }],
    healthNotes: { type: String, trim: true, maxlength: 500 },
    addresses: [
      {
        name: { type: String, trim: true, maxlength: 100 },
        phone: { type: String, trim: true, maxlength: 20 },
        line1: { type: String, trim: true, maxlength: 200 },
        line2: { type: String, trim: true, maxlength: 200 },
        landmark: { type: String, trim: true, maxlength: 120 },
        city: { type: String, trim: true, maxlength: 80 },
        pincode: { type: String, trim: true, maxlength: 10 },
      },
    ],
    lastLoginAt: Date,
    loginCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

function ageFrom(dob) {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    uid: this.uid,
    email: this.email,
    displayName: this.displayName,
    photoURL: this.photoURL,
    phoneNumber: this.phoneNumber,
    addresses: this.addresses,
    dob: this.dob,
    age: ageFrom(this.dob),
    gender: this.gender,
    healthConditions: this.healthConditions,
    healthNotes: this.healthNotes,
    providers: this.providers,
    emailVerified: this.emailVerified,
    role: this.role,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
