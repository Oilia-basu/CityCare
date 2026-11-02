const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    patientCode: { type: String, unique: true, sparse: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''], default: '' },
    address: { type: String, maxlength: 300 },
    emergencyContact: { name: String, phone: String, relation: String },
    // Restricted: only the patient, authorised doctors (with an appointment) and admins may read these.
    medicalHistory: { type: String, maxlength: 3000 },
    allergies: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

patientSchema.pre('validate', function (next) {
  if (!this.patientCode) this.patientCode = 'PAT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  next();
});

module.exports = mongoose.model('Patient', patientSchema);
