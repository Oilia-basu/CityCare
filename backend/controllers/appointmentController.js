const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const { asyncHandler, sendSuccess, paginate, pageMeta, AppError } = require('../utils/apiResponse');
const { POPULATE } = require('../services/appointmentPopulate');
const svc = require('../services/appointmentService');
const availability = require('../services/availabilityService');
const { getSettings } = require('../services/settingsService');

// POST /api/appointments
exports.create = asyncHandler(async (req, res) => {
  const appt = await svc.createAppointment(req.user, req.body);
  sendSuccess(res, { appointment: appt }, 'Appointment booked', 201);
});

// GET /api/appointments?status=&date=&from=&to=&search=&doctorId=&patientId=&when=upcoming&sort=&page=&limit=
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = await svc.buildFilter(req.user, req.query);
  const sort = svc.SORTS[req.query.sort] || svc.SORTS.date_desc;
  const [items, total] = await Promise.all([Appointment.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit), Appointment.countDocuments(filter)]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});

// GET /api/appointments/:id
exports.getOne = asyncHandler(async (req, res) => sendSuccess(res, { appointment: await svc.getAppointment(req.params.id, req.user) }));

// PUT /api/appointments/:id/cancel  { reason }
exports.cancel = asyncHandler(async (req, res) => sendSuccess(res, { appointment: await svc.cancelAppointment(req.user, req.params.id, req.body.reason) }, 'Appointment cancelled'));

// PUT /api/appointments/:id/reschedule  { date, startTime }
exports.reschedule = asyncHandler(async (req, res) => sendSuccess(res, { appointment: await svc.rescheduleAppointment(req.user, req.params.id, req.body) }, 'Appointment rescheduled'));

// PUT /api/appointments/:id/status  { status, notes?, reason? }
exports.updateStatus = asyncHandler(async (req, res) => sendSuccess(res, { appointment: await svc.updateStatus(req.user, req.params.id, req.body) }, `Status updated to ${req.body.status}`));

// GET /api/appointments/available-slots?doctorId=&date=
exports.availableSlots = asyncHandler(async (req, res) => {
  if (!req.query.doctorId) throw new AppError('doctorId is required', 400);
  sendSuccess(res, await availability.getSlots(req.query.doctorId, req.query.date));
});

// GET /api/appointments/:id/receipt
exports.receipt = asyncHandler(async (req, res) => {
  const appointment = await svc.getAppointment(req.params.id, req.user);
  const [payment, settings] = await Promise.all([Payment.findOne({ appointment: appointment._id }), getSettings()]);
  sendSuccess(res, {
    appointment,
    payment,
    hospital: { name: settings.hospitalName, address: settings.address, phone: settings.phone, email: settings.email },
    issuedAt: new Date(),
  });
});
