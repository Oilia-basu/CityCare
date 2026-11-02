// Core booking record.
// Double-booking protection: `slotKey` is set only while the appointment occupies the slot and is protected by a
// partial UNIQUE index, so two simultaneous requests for the same doctor/date/time can never both succeed.
// Releasing a slot = $unset slotKey.
const mongoose = require('mongoose');

const STATUSES = ['Pending', 'Confirmed', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'Rejected', 'No-Show'];
const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Checked-In', 'In-Progress'];

const appointmentSchema = new mongoose.Schema(
  {
    appointmentCode: { type: String, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    appointmentDate: { type: String, required: true, index: true }, // hospital-local YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true },
    startAt: { type: Date, required: true, index: true }, // UTC instant
    reason: { type: String, trim: true, maxlength: 500 },
    symptoms: { type: String, trim: true, maxlength: 1000 },
    consultationFee: { type: Number, required: true },
    appointmentStatus: { type: String, enum: STATUSES, default: 'Pending', index: true },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Refunded'], default: 'Pending' },
    paymentMethod: { type: String, enum: ['Online', 'Cash'], default: 'Cash' },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    slotKey: { type: String },
    reservationExpiresAt: Date, // only for unpaid online reservations
    checkedInAt: Date,
    queueNumber: Number,
    completedAt: Date,
    consultationNotes: { type: String, maxlength: 3000 },
    cancellationReason: String,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    rescheduleCount: { type: Number, default: 0 },
    reminderSent: { type: Boolean, default: false },
    isReviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

appointmentSchema.index({ slotKey: 1 }, { unique: true, partialFilterExpression: { slotKey: { $type: 'string' } } });
appointmentSchema.index({ doctor: 1, appointmentDate: 1 });
appointmentSchema.index({ appointmentStatus: 1, reservationExpiresAt: 1 });

appointmentSchema.pre('validate', function (next) {
  if (!this.appointmentCode) this.appointmentCode = 'APT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  next();
});

const Appointment = mongoose.model('Appointment', appointmentSchema);
Appointment.STATUSES = STATUSES;
Appointment.ACTIVE_STATUSES = ACTIVE_STATUSES;
module.exports = Appointment;
