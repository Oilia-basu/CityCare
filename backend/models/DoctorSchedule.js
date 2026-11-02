// One weekly working window per doctor per weekday (0 = Sunday ... 6 = Saturday). Times are hospital-local "HH:mm".
const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDuration: { type: Number, default: 30, min: 5, max: 240 },
    breakStart: String,
    breakEnd: String,
    maxPatientsPerDay: { type: Number, default: 50, min: 1 }, // appointment capacity
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
scheduleSchema.index({ doctor: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('DoctorSchedule', scheduleSchema);
