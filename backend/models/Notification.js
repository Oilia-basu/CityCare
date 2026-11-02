const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['booking', 'confirmation', 'cancellation', 'reschedule', 'payment_success', 'payment_failure', 'status', 'reminder', 'completion', 'system'],
      default: 'system',
    },
    relatedAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
