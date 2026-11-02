const Payment = require('../models/Payment');
const Patient = require('../models/Patient');
const { asyncHandler, sendSuccess, paginate, pageMeta, AppError } = require('../utils/apiResponse');
const svc = require('../services/paymentService');
const { logActivity } = require('../services/activityService');

const POP = [
  { path: 'patient', populate: { path: 'user', select: 'name email' } },
  { path: 'appointment', select: 'appointmentCode appointmentDate startTime appointmentStatus doctor', populate: { path: 'doctor', select: 'user', populate: { path: 'user', select: 'name' } } },
];

// POST /api/payments/create-order { appointmentId }
exports.createOrder = asyncHandler(async (req, res) => {
  if (!req.body.appointmentId) throw new AppError('appointmentId is required', 400);
  sendSuccess(res, await svc.createOrder(req.user, req.body.appointmentId), 'Order created');
});

// POST /api/payments/verify
exports.verify = asyncHandler(async (req, res) => {
  const out = await svc.verifyPayment(req.user, req.body);
  sendSuccess(res, { appointment: out.appointment, payment: out.payment, alreadyProcessed: !!out.already }, 'Payment verified');
});

// POST /api/payments/webhook  (raw body; mounted before express.json in app.js)
exports.webhook = asyncHandler(async (req, res) => {
  const out = await svc.handleWebhook(req.body, req.headers['x-razorpay-signature']);
  res.json({ success: true, ...out });
});

// GET /api/payments/history?status=&page=&limit=   role-scoped
exports.history = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.user.role === 'patient') filter.patient = (await Patient.findOne({ user: req.user._id }).select('_id'))?._id;
  else if (!['admin', 'receptionist'].includes(req.user.role)) throw new AppError('Not allowed', 403);
  if (req.query.status) filter.paymentStatus = req.query.status;
  if (req.query.method) filter.paymentMethod = req.query.method;
  const [items, total] = await Promise.all([Payment.find(filter).populate(POP).sort({ createdAt: -1 }).skip(skip).limit(limit), Payment.countDocuments(filter)]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});

// POST /api/payments/refund  { paymentId, reason }  (admin)
exports.refund = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.body.paymentId);
  if (!payment) throw new AppError('Payment not found', 404);
  await svc.refundPayment(payment, req.body.reason || 'Refund issued by admin');
  await logActivity(req.user, 'PAYMENT_REFUNDED', `Refund for payment ${payment._id}`, 'Payment', payment._id);
  sendSuccess(res, { payment }, 'Refund processed');
});

// PUT /api/payments/:appointmentId/mark-paid  (receptionist/admin, cash only)
exports.markPaid = asyncHandler(async (req, res) => sendSuccess(res, { payment: await svc.markCashPaid(req.user, req.params.appointmentId) }, 'Payment recorded'));
