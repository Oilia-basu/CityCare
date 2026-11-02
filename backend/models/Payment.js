const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true }, // one payment per appointment
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: ['Online', 'Cash'], required: true },
    transactionId: String,
    gatewayOrderId: { type: String, index: true },
    gatewayPaymentId: { type: String, index: true, sparse: true },
    gatewayRefundId: String,
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Refunded'], default: 'Pending' },
    refundStatus: { type: String, enum: ['None', 'Processed', 'Failed'], default: 'None' },
    refundedAt: Date,
    refundReason: String,
    paidAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
