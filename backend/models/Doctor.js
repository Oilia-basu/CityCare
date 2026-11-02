const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    specialization: { type: String, required: true, trim: true, index: true },
    qualification: { type: String, required: true, trim: true },
    experience: { type: Number, default: 0, min: 0 },
    licenseNumber: { type: String, required: true, unique: true, trim: true },
    consultationFee: { type: Number, required: true, min: 0 },
    biography: { type: String, maxlength: 2000 },
    availableDays: [{ type: Number, min: 0, max: 6 }], // derived from DoctorSchedule
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true }, // "accepting appointments"
    blockedDates: [{ date: String, reason: String, _id: false }], // YYYY-MM-DD, hospital-local
    leaves: [{ from: String, to: String, reason: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
