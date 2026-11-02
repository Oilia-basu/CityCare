// Razorpay integration. The frontend is NEVER trusted for payment success:
// the HMAC signature is verified server-side, processing is idempotent, and late payments on expired slots are auto-refunded.
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const { AppError } = require('../utils/apiResponse');
const { POPULATE } = require('./appointmentPopulate');
const { notify } = require('./notificationService');
const { sendAppointmentEmail } = require('./emailService');
const { getSettings } = require('./settingsService');
const { logActivity } = require('./activityService');

let client;
const getClient = () => {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret || id.startsWith('your_')) throw new AppError('Online payments are switched off. Choose "Pay at hospital" instead.', 503);
  if (!client) client = new Razorpay({ key_id: id, key_secret: secret });
  return client;
};

const isConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_ID.startsWith('your_'));

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

const isOwnerOrStaff = (appt, user) =>
  ['admin', 'receptionist'].includes(user.role) || (user.role === 'patient' && String(appt.patient.user._id) === String(user._id));

const loadAppt = (id) => Appointment.findById(id).populate(POPULATE);

// ---------- create order ----------
const createOrder = async (user, appointmentId) => {
  const appt = await loadAppt(appointmentId);
  if (!appt) throw new AppError('Appointment not found', 404);
  if (!isOwnerOrStaff(appt, user)) throw new AppError('You cannot pay for this appointment', 403);
  if (appt.paymentMethod !== 'Online') throw new AppError('This appointment is set to pay at the hospital', 400);
  if (appt.paymentStatus === 'Paid') throw new AppError('This appointment is already paid', 409);
  if (appt.paymentStatus === 'Refunded') throw new AppError('This payment was refunded; please book again', 409);
  if (!['Pending', 'Confirmed'].includes(appt.appointmentStatus)) throw new AppError('This appointment can no longer be paid for', 409);
  if (appt.reservationExpiresAt && appt.reservationExpiresAt < new Date()) throw new AppError('Your reserved slot has expired. Please book again.', 410);

  const rz = getClient();
  let payment = await Payment.findOne({ appointment: appt._id });
  if (!payment) throw new AppError('Payment record missing', 500);

  if (!payment.gatewayOrderId) {
    const order = await rz.orders.create({
      amount: Math.round(appt.consultationFee * 100), // trusted DB fee, in paise
      currency: payment.currency || 'INR',
      receipt: appt.appointmentCode,
      notes: { appointmentId: String(appt._id), patientId: String(appt.patient._id) },
    });
    payment.gatewayOrderId = order.id;
    await payment.save();
  }
  return {
    orderId: payment.gatewayOrderId,
    amount: Math.round(appt.consultationFee * 100),
    currency: payment.currency || 'INR',
    keyId: process.env.RAZORPAY_KEY_ID,
    appointmentId: appt._id,
    prefill: { name: appt.patient.user.name, email: appt.patient.user.email, contact: appt.patient.user.phone },
    expiresAt: appt.reservationExpiresAt,
  };
};

// ---------- refund ----------
const refundPayment = async (payment, reason = 'Appointment cancelled') => {
  if (payment.paymentStatus === 'Refunded') return payment;
  if (payment.paymentStatus !== 'Paid') throw new AppError('Only paid payments can be refunded', 400);
  if (payment.paymentMethod === 'Online') {
    try {
      const r = await getClient().payments.refund(payment.gatewayPaymentId, { amount: Math.round(payment.amount * 100), notes: { reason: String(reason).slice(0, 200) } });
      payment.gatewayRefundId = r.id;
    } catch (e) {
      payment.refundStatus = 'Failed';
      await payment.save();
      throw new AppError(`Refund failed at the gateway: ${e.error?.description || e.message}`, 502);
    }
  }
  payment.paymentStatus = 'Refunded';
  payment.refundStatus = 'Processed';
  payment.refundedAt = new Date();
  payment.refundReason = reason;
  await payment.save();
  await Appointment.updateOne({ _id: payment.appointment }, { paymentStatus: 'Refunded' });
  return payment;
};

// ---------- finalize a verified/captured payment (idempotent) ----------
const finalizePaid = async (payment, gatewayPaymentId) => {
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, paymentStatus: { $in: ['Pending', 'Failed'] } },
    { $set: { paymentStatus: 'Paid', gatewayPaymentId, transactionId: gatewayPaymentId, paidAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    const current = await Payment.findById(payment._id);
    if (current.paymentStatus === 'Paid' && current.gatewayPaymentId === gatewayPaymentId) return { payment: current, already: true };
    if (current.paymentStatus === 'Paid') throw new AppError('This appointment has already been paid for', 409);
    throw new AppError('This payment can no longer be processed', 409);
  }

  const appt = await loadAppt(claimed.appointment);
  // Slot was released (reservation expired / cancelled) before the money arrived -> refund automatically.
  if (!appt || ['Cancelled', 'Rejected'].includes(appt.appointmentStatus)) {
    try { await refundPayment(claimed, 'Payment received after the reservation expired'); } catch (e) { console.error('Auto-refund failed:', e.message); }
    throw new AppError('Your reserved slot expired before payment completed. The amount will be refunded; please book again.', 409);
  }

  const settings = await getSettings();
  const nextStatus = appt.appointmentStatus === 'Pending' && settings.autoConfirmAppointments ? 'Confirmed' : appt.appointmentStatus;
  await Appointment.updateOne({ _id: appt._id }, { $set: { paymentStatus: 'Paid', appointmentStatus: nextStatus }, $unset: { reservationExpiresAt: '' } });
  const fresh = await loadAppt(appt._id);

  await notify(fresh.patient.user._id, { title: 'Payment successful', message: `₹${fresh.consultationFee} received for appointment ${fresh.appointmentCode}.`, type: 'payment_success', appointment: fresh });
  await notify(fresh.doctor.user._id, {
    title: nextStatus === 'Confirmed' ? 'New confirmed appointment' : 'New appointment request',
    message: `${fresh.patient.user.name} • ${fresh.appointmentDate} ${fresh.startTime}`,
    type: nextStatus === 'Confirmed' ? 'confirmation' : 'booking',
    appointment: fresh,
  });
  sendAppointmentEmail('payment', fresh);
  await logActivity(fresh.patient.user._id, 'PAYMENT_SUCCESS', `Payment ${gatewayPaymentId} for ${fresh.appointmentCode}`, 'Payment', claimed._id);
  return { payment: claimed, appointment: fresh };
};

// ---------- verify (called by frontend after checkout) ----------
const verifyPayment = async (user, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) throw new AppError('Missing payment details', 400);
  const payment = await Payment.findOne({ gatewayOrderId: razorpay_order_id });
  if (!payment) throw new AppError('Payment order not found', 404);
  const appt = await loadAppt(payment.appointment);
  if (!isOwnerOrStaff(appt, user)) throw new AppError('You cannot verify this payment', 403);

  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  if (!safeEqual(expected, razorpay_signature)) {
    await notify(appt.patient.user._id, { title: 'Payment verification failed', message: `We could not verify your payment for ${appt.appointmentCode}.`, type: 'payment_failure', appointment: appt });
    await logActivity(user, 'PAYMENT_SIGNATURE_INVALID', `Invalid signature for order ${razorpay_order_id}`, 'Payment', payment._id);
    throw new AppError('Payment verification failed (invalid signature).', 400);
  }
  return finalizePaid(payment, razorpay_payment_id);
};

// ---------- webhook (server-to-server safety net) ----------
const handleWebhook = async (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || secret.startsWith('your_')) throw new AppError('Webhook secret not configured', 503);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!signature || !safeEqual(expected, signature)) throw new AppError('Invalid webhook signature', 400);

  const event = JSON.parse(rawBody.toString('utf8'));
  const entity = event.payload?.payment?.entity;
  if (!entity?.order_id) return { ignored: true };
  const payment = await Payment.findOne({ gatewayOrderId: entity.order_id });
  if (!payment) return { ignored: true };

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    try { await finalizePaid(payment, entity.id); } catch (e) { if (e.statusCode !== 409) throw e; }
  } else if (event.event === 'payment.failed' && payment.paymentStatus === 'Pending') {
    const appt = await loadAppt(payment.appointment);
    await notify(appt.patient.user._id, { title: 'Payment failed', message: `Your payment for ${appt.appointmentCode} failed. You can retry before the slot expires.`, type: 'payment_failure', appointment: appt });
  }
  return { handled: event.event };
};

// Staff marks a pay-at-hospital appointment as paid.
const markCashPaid = async (user, appointmentId) => {
  const appt = await loadAppt(appointmentId);
  if (!appt) throw new AppError('Appointment not found', 404);
  if (appt.paymentMethod !== 'Cash') throw new AppError('Only pay-at-hospital appointments can be marked paid', 400);
  if (['Cancelled', 'Rejected'].includes(appt.appointmentStatus)) throw new AppError('This appointment is closed', 400);
  const payment = await Payment.findOneAndUpdate(
    { appointment: appt._id, paymentStatus: 'Pending' },
    { $set: { paymentStatus: 'Paid', paidAt: new Date(), transactionId: `CASH-${appt.appointmentCode}` } },
    { new: true }
  );
  if (!payment) throw new AppError('This appointment is already settled', 409);
  await Appointment.updateOne({ _id: appt._id }, { paymentStatus: 'Paid' });
  await notify(appt.patient.user._id, { title: 'Payment recorded', message: `Cash payment of ₹${appt.consultationFee} recorded for ${appt.appointmentCode}.`, type: 'payment_success', appointment: appt });
  await logActivity(user, 'CASH_PAYMENT_RECORDED', `Cash payment for ${appt.appointmentCode}`, 'Payment', payment._id);
  return payment;
};

module.exports = { isConfigured, createOrder, verifyPayment, handleWebhook, refundPayment, markCashPaid };
