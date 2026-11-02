// Shared populate spec so every appointment payload has the same shape.
const POPULATE = [
  { path: 'patient', populate: { path: 'user', select: 'name email phone profileImage' } },
  { path: 'doctor', populate: { path: 'user', select: 'name email phone profileImage' } },
  { path: 'department', select: 'name' },
  { path: 'payment', select: 'paymentStatus paymentMethod amount paidAt transactionId refundStatus' },
];
module.exports = { POPULATE };
