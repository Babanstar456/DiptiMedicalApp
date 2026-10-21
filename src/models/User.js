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
    lastLoginAt: Date,
    loginCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    uid: this.uid,
    email: this.email,
    displayName: this.displayName,
    photoURL: this.photoURL,
    phoneNumber: this.phoneNumber,
    providers: this.providers,
    emailVerified: this.emailVerified,
    role: this.role,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
