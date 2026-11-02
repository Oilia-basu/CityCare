const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { asyncHandler, sendSuccess, paginate, pageMeta, AppError, escapeRegex } = require('../utils/apiResponse');
const { POPULATE } = require('../services/appointmentPopulate');
const svc = require('../services/appointmentService');
const { createPatientAccount, tempPassword } = require('../services/profileService');
const { sendWelcomeCredentials } = require('../services/emailService');
const { logActivity } = require('../services/activityService');
const { localNow, isValidDate } = require('../utils/dateUtils');

// GET /api/receptionist/dashboard?date=YYYY-MM-DD
exports.dashboard = asyncHandler(async (req, res) => {
  const date = isValidDate(req.query.date) ? req.query.date : localNow().date;
  const [list, counts, unpaid] = await Promise.all([
    Appointment.find({ appointmentDate: date, appointmentStatus: { $nin: ['Cancelled', 'Rejected'] } }).populate(POPULATE).sort({ startTime: 1 }),
    Appointment.aggregate([{ $match: { appointmentDate: date } }, { $group: { _id: '$appointmentStatus', n: { $sum: 1 } } }]),
    Appointment.countDocuments({ appointmentDate: date, paymentStatus: 'Pending', appointmentStatus: { $in: ['Confirmed', 'Checked-In', 'In-Progress', 'Completed'] } }),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  sendSuccess(res, {
    date,
    stats: {
      total: counts.reduce((s, c) => s + c.n, 0), pending: by.Pending || 0, confirmed: by.Confirmed || 0,
      checkedIn: (by['Checked-In'] || 0) + (by['In-Progress'] || 0), completed: by.Completed || 0, cancelled: (by.Cancelled || 0) + (by.Rejected || 0), unpaid,
    },
    appointments: list,
  });
});

// POST /api/receptionist/patients  { name, email, phone, ...profile }  -> walk-in registration with a temporary password
exports.registerPatient = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name?.trim() || !email?.trim() || !phone?.trim()) throw new AppError('Name, email and phone are required', 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AppError('Enter a valid email', 400);
  const password = tempPassword();
  const { user, patient } = await createPatientAccount({ ...req.body, name: name.trim(), email: email.trim().toLowerCase(), phone, password, isVerified: true });
  sendWelcomeCredentials(user, password, `${(process.env.CLIENT_URL || '').split(',')[0]}/login`);
  await logActivity(req.user, 'PATIENT_REGISTERED', `Walk-in patient ${user.email}`, 'Patient', patient._id);
  // temporaryPassword is returned ONCE so reception can hand it over; it is never stored in plain text.
  sendSuccess(res, { user, patient, temporaryPassword: password }, 'Patient registered', 201);
});

// GET /api/receptionist/patients?search=&page=&limit=
exports.searchPatients = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    const users = await User.find({ role: 'patient', $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select('_id');
    filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { patientCode: rx }];
  }
  const [items, total] = await Promise.all([
    Patient.find(filter).select('-medicalHistory -allergies').populate('user', 'name email phone profileImage isActive').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Patient.countDocuments(filter),
  ]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});

// POST /api/receptionist/appointments  { patientId, doctorId, date, startTime, reason, paymentMethod }
exports.book = asyncHandler(async (req, res) => {
  const appointment = await svc.createAppointment(req.user, req.body);
  sendSuccess(res, { appointment }, 'Appointment booked', 201);
});

// PUT /api/receptionist/appointments/:id  { action: 'reschedule' | 'cancel' | 'no-show', date, startTime, reason }
exports.update = asyncHandler(async (req, res) => {
  const { action } = req.body;
  let appointment;
  if (action === 'reschedule') appointment = await svc.rescheduleAppointment(req.user, req.params.id, req.body);
  else if (action === 'cancel') appointment = await svc.cancelAppointment(req.user, req.params.id, req.body.reason || 'Cancelled at reception');
  else if (action === 'no-show') appointment = await svc.updateStatus(req.user, req.params.id, { status: 'No-Show' });
  else throw new AppError('action must be reschedule, cancel or no-show', 400);
  sendSuccess(res, { appointment }, 'Appointment updated');
});

// PUT /api/receptionist/appointments/:id/check-in
exports.checkIn = asyncHandler(async (req, res) => sendSuccess(res, { appointment: await svc.checkIn(req.user, req.params.id) }, 'Patient checked in'));

// GET /api/receptionist/queue?date=&doctorId=   today's waiting room, ordered by queue number
exports.queue = asyncHandler(async (req, res) => {
  const date = isValidDate(req.query.date) ? req.query.date : localNow().date;
  const filter = { appointmentDate: date, appointmentStatus: { $in: ['Checked-In', 'In-Progress'] } };
  if (req.query.doctorId) filter.doctor = req.query.doctorId;
  const items = await Appointment.find(filter).populate(POPULATE).sort({ doctor: 1, queueNumber: 1 });
  sendSuccess(res, { date, items });
});
