// Singleton hospital + booking configuration (key = "main"). Editable by admins only.
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    hospitalName: { type: String, default: 'CityCare Hospital' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    about: { type: String, default: '' },
    emergencyNumber: { type: String, default: '' },
    workingHours: { type: String, default: 'Mon–Sat, 8:00 AM – 8:00 PM' },
    autoConfirmAppointments: { type: Boolean, default: true },
    cancellationDeadlineHours: { type: Number, default: 2 },
    rescheduleDeadlineHours: { type: Number, default: 4 },
    maxReschedules: { type: Number, default: 2 },
    maxAdvanceBookingDays: { type: Number, default: 60 },
    minLeadMinutes: { type: Number, default: 30 },
    reservationMinutes: { type: Number, default: 10 }, // how long an unpaid online slot is held
    cashPaymentEnabled: { type: Boolean, default: true },
    onlinePaymentEnabled: { type: Boolean, default: false },
    allowDoctorsToSetFee: { type: Boolean, default: false },
    emailNotificationsEnabled: { type: Boolean, default: true },
    reminderHoursBefore: { type: Number, default: 24 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
