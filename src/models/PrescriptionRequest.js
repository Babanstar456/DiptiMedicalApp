const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

// "Upload prescription": the pharmacy calls the customer back and prepares the order.
const prescriptionRequestSchema = new mongoose.Schema(
  {
    requestNo: { type: String, unique: true },
    user: { type: ObjectId, ref: 'User', required: true },
    image: { type: String, required: true }, // private Image id
    name: { type: String, trim: true, maxlength: 100, required: true },
    phone: { type: String, trim: true, maxlength: 20, required: true },
    address: { type: String, trim: true, maxlength: 400 },
    notes: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['new', 'called', 'ordered', 'closed'], default: 'new', index: true },
    staffNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PrescriptionRequest', prescriptionRequestSchema);
