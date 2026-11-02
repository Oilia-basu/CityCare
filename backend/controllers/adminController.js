const mongoose = require('mongoose');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Receptionist = require('../models/Receptionist');
const Department = require('../models/Department');
const DoctorSchedule = require('../models/DoctorSchedule');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const Settings = require('../models/Settings');
const { asyncHandler, sendSuccess, paginate, pageMeta, AppError, escapeRegex } = require('../utils/apiResponse');
const { POPULATE } = require('../services/appointmentPopulate');
const svc = require('../services/appointmentService');
const availability = require('../services/availabilityService');
const { assertEmailFree, tempPassword, applyProfileImage, pickPatientFields } = require('../services/profileService');
const { sendWelcomeCredentials } = require('../services/emailService');
const { getSettings } = require('../services/settingsService');
const { logActivity } = require('../services/activityService');
const { localNow, addDays, offsetMinutes } = require('../utils/dateUtils');

const DOC_POP = [{ path: 'user', select: 'name email phone profileImage isActive' }, { path: 'department', select: 'name' }];
const bool = (v) => v === true || v === 'true';

// ---------------------------------------------------------------- analytics
const tzString = () => {
  const m = offsetMinutes();
  const sign = m < 0 ? '-' : '+';
  const a = Math.abs(m);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};
const lastMonths = (n) => {
  const [y, m] = localNow().date.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
};

const buildAnalytics = async (months = 6) => {
  const keys = lastMonths(months);
  const start = new Date(Date.UTC(+keys[0].slice(0, 4), +keys[0].slice(5) - 1, 1) - offsetMinutes() * 60000);
  const tz = tzString();
  const today = localNow().date;
  const [apptM, revM, status, perDay, topDocs, byDept] = await Promise.all([
    Appointment.aggregate([{ $match: { startAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$startAt', timezone: tz } }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$appointmentStatus', 'Completed'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $in: ['$appointmentStatus', ['Cancelled', 'Rejected']] }, 1, 0] } } } }]),
    Payment.aggregate([{ $match: { paymentStatus: 'Paid', paidAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: tz } }, revenue: { $sum: '$amount' } } }]),
    Appointment.aggregate([{ $group: { _id: '$appointmentStatus', value: { $sum: 1 } } }]),
    Appointment.aggregate([{ $match: { appointmentDate: { $gte: addDays(today, -13), $lte: today } } }, { $group: { _id: '$appointmentDate', total: { $sum: 1 } } }]),
    Appointment.aggregate([{ $match: { appointmentStatus: 'Completed' } }, { $group: { _id: '$doctor', completed: { $sum: 1 }, revenue: { $sum: '$consultationFee' } } }, { $sort: { completed: -1 } }, { $limit: 5 }]),
    Appointment.aggregate([{ $group: { _id: '$department', value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
  ]);
  const aM = Object.fromEntries(apptM.map((r) => [r._id, r]));
  const rM = Object.fromEntries(revM.map((r) => [r._id, r.revenue]));
  const dM = Object.fromEntries(perDay.map((r) => [r._id, r.total]));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  await Doctor.populate(topDocs, { path: '_id', select: 'user specialization', populate: { path: 'user', select: 'name' } });
  await Department.populate(byDept, { path: '_id', select: 'name' });

  return {
    monthly: keys.map((k) => ({ month: k, appointments: aM[k]?.total || 0, completed: aM[k]?.completed || 0, cancelled: aM[k]?.cancelled || 0, revenue: rM[k] || 0 })),
    daily: days.map((d) => ({ date: d, appointments: dM[d] || 0 })),
    statusDistribution: status.map((s) => ({ name: s._id, value: s.value })),
    topDoctors: topDocs.map((t) => ({ doctorId: t._id?._id, name: t._id?.user?.name || 'Unknown', specialization: t._id?.specialization, completed: t.completed, revenue: t.revenue })),
    byDepartment: byDept.map((d) => ({ name: d._id?.name || 'Unassigned', value: d.value })),
  };
};

// GET /api/admin/dashboard
exports.dashboard = asyncHandler(async (_req, res) => {
  const [roles, departments, statuses, revenue, recent, analytics] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    Department.countDocuments(),
    Appointment.aggregate([{ $group: { _id: '$appointmentStatus', n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { paymentStatus: 'Paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Appointment.find().populate(POPULATE).sort({ createdAt: -1 }).limit(8),
    buildAnalytics(6),
  ]);
  const r = Object.fromEntries(roles.map((x) => [x._id, x.n]));
  const s = Object.fromEntries(statuses.map((x) => [x._id, x.n]));
  sendSuccess(res, {
    stats: {
      patients: r.patient || 0, doctors: r.doctor || 0, receptionists: r.receptionist || 0, departments,
      appointments: statuses.reduce((a, x) => a + x.n, 0), pending: s.Pending || 0, completed: s.Completed || 0,
      cancelled: (s.Cancelled || 0) + (s.Rejected || 0), revenue: revenue[0]?.total || 0,
    },
    recent, analytics,
  });
});

// GET /api/admin/analytics?months=6
exports.analytics = asyncHandler(async (req, res) => sendSuccess(res, await buildAnalytics(Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24))));

// ---------------------------------------------------------------- users
// GET /api/admin/users?role=&search=&isActive=&page=
exports.users = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive) filter.isActive = bool(req.query.isActive);
  if (req.query.search) { const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i'); filter.$or = [{ name: rx }, { email: rx }, { phone: rx }]; }
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(filter)]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});

// PUT /api/admin/users/:id/status  { isActive }
exports.setUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (String(user._id) === String(req.user._id)) throw new AppError('You cannot deactivate your own account', 400);
  if (user.role === 'admin') throw new AppError('Administrator accounts cannot be changed here', 403);
  user.isActive = bool(req.body.isActive);
  await user.save();
  await logActivity(req.user, user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', `${user.role} ${user.email}`, 'User', user._id);
  sendSuccess(res, { user }, user.isActive ? 'Account activated' : 'Account deactivated');
});

// ---------------------------------------------------------------- doctors
// GET /api/admin/doctors?search=&department=&isVerified=&page=
exports.listDoctors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.query.department) filter.department = req.query.department;
  if (req.query.isVerified) filter.isVerified = bool(req.query.isVerified);
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    const users = await User.find({ role: 'doctor', $or: [{ name: rx }, { email: rx }] }).select('_id');
    filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { specialization: rx }, { licenseNumber: rx }];
  }
  const [items, total] = await Promise.all([Doctor.find(filter).populate(DOC_POP).sort({ createdAt: -1 }).skip(skip).limit(limit), Doctor.countDocuments(filter)]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});

const DEFAULT_SCHEDULE = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '13:00', slotDuration: 30 }));

// POST /api/admin/doctors
exports.createDoctor = asyncHandler(async (req, res) => {
  const b = req.body;
  for (const f of ['name', 'email', 'phone', 'department', 'specialization', 'qualification', 'licenseNumber', 'consultationFee']) {
    if (b[f] === undefined || String(b[f]).trim() === '') throw new AppError(`${f} is required`, 400);
  }
  if (!/^\S+@\S+\.\S+$/.test(b.email)) throw new AppError('Enter a valid email', 400);
  if (!(Number(b.consultationFee) >= 0)) throw new AppError('Consultation fee must be zero or more', 400);
  if (!(await Department.exists({ _id: b.department }))) throw new AppError('Department not found', 404);
  await assertEmailFree(b.email);
  if (await Doctor.exists({ licenseNumber: b.licenseNumber.trim() })) throw new AppError('A doctor with this license number already exists', 409);

  const password = b.password || tempPassword();
  const user = new User({ name: b.name.trim(), email: b.email.trim().toLowerCase(), phone: b.phone, password, role: 'doctor', isVerified: true });
  await applyProfileImage(user, req.file);
  await user.save();
  let doctor;
  try {
    doctor = await Doctor.create({
      user: user._id, department: b.department, specialization: b.specialization.trim(), qualification: b.qualification.trim(),
      experience: Number(b.experience) || 0, licenseNumber: b.licenseNumber.trim(), consultationFee: Number(b.consultationFee),
      biography: b.biography, isVerified: b.isVerified === undefined ? true : bool(b.isVerified),
    });
    await availability.saveAvailability(doctor, { schedule: DEFAULT_SCHEDULE });
  } catch (e) {
    await User.deleteOne({ _id: user._id });
    if (doctor) { await Doctor.deleteOne({ _id: doctor._id }); await DoctorSchedule.deleteMany({ doctor: doctor._id }); }
    throw e;
  }
  sendWelcomeCredentials(user, password, `${(process.env.CLIENT_URL || '').split(',')[0]}/doctor/login`);
  await logActivity(req.user, 'DOCTOR_CREATED', `${user.name} (${user.email})`, 'Doctor', doctor._id);
  sendSuccess(res, { doctor: await Doctor.findById(doctor._id).populate(DOC_POP), temporaryPassword: b.password ? undefined : password }, 'Doctor created', 201);
});

// PUT /api/admin/doctors/:id
exports.updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new AppError('Doctor not found', 404);
  const user = await User.findById(doctor.user);
  const b = req.body;
  if (b.name !== undefined) user.name = b.name.trim();
  if (b.phone !== undefined) user.phone = b.phone;
  if (b.isActive !== undefined) user.isActive = bool(b.isActive);
  if (b.email !== undefined && b.email.toLowerCase() !== user.email) { await assertEmailFree(b.email); user.email = b.email.trim().toLowerCase(); }
  await applyProfileImage(user, req.file);
  await user.save();
  if (b.department !== undefined) { if (!(await Department.exists({ _id: b.department }))) throw new AppError('Department not found', 404); doctor.department = b.department; }
  ['specialization', 'qualification', 'biography'].forEach((k) => { if (b[k] !== undefined) doctor[k] = b[k]; });
  if (b.licenseNumber !== undefined && b.licenseNumber !== doctor.licenseNumber) {
    if (await Doctor.exists({ licenseNumber: b.licenseNumber, _id: { $ne: doctor._id } })) throw new AppError('License number already in use', 409);
    doctor.licenseNumber = b.licenseNumber;
  }
  if (b.experience !== undefined) doctor.experience = Number(b.experience) || 0;
  if (b.consultationFee !== undefined) { const f = Number(b.consultationFee); if (!(f >= 0)) throw new AppError('Invalid fee', 400); doctor.consultationFee = f; }
  if (b.isVerified !== undefined) doctor.isVerified = bool(b.isVerified);
  if (b.isAvailable !== undefined) doctor.isAvailable = bool(b.isAvailable);
  await doctor.save();
  await logActivity(req.user, 'DOCTOR_UPDATED', user.name, 'Doctor', doctor._id);
  sendSuccess(res, { doctor: await Doctor.findById(doctor._id).populate(DOC_POP) }, 'Doctor updated');
});

// DELETE /api/admin/doctors/:id  -> hard delete when the doctor has no history, otherwise deactivate
exports.deleteDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).populate('user', 'name');
  if (!doctor) throw new AppError('Doctor not found', 404);
  const upcoming = await Appointment.countDocuments({ doctor: doctor._id, appointmentStatus: { $in: svc.ACTIVE_STATUSES }, startAt: { $gte: new Date() } });
  if (upcoming) throw new AppError(`This doctor has ${upcoming} upcoming appointment(s). Cancel or reassign them first.`, 409);
  const history = await Appointment.countDocuments({ doctor: doctor._id });
  if (history) {
    await User.updateOne({ _id: doctor.user._id }, { isActive: false });
    await Doctor.updateOne({ _id: doctor._id }, { isAvailable: false });
    await logActivity(req.user, 'DOCTOR_DEACTIVATED', doctor.user.name, 'Doctor', doctor._id);
    return sendSuccess(res, { deactivated: true }, 'Doctor has past appointments, so the account was deactivated instead of deleted');
  }
  await DoctorSchedule.deleteMany({ doctor: doctor._id });
  await Doctor.deleteOne({ _id: doctor._id });
  await User.deleteOne({ _id: doctor.user._id });
  await logActivity(req.user, 'DOCTOR_DELETED', doctor.user.name, 'Doctor', doctor._id);
  sendSuccess(res, { deleted: true }, 'Doctor deleted');
});

// GET/PUT /api/admin/doctors/:id/schedule
exports.getDoctorSchedule = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).populate(DOC_POP);
  if (!doctor) throw new AppError('Doctor not found', 404);
  sendSuccess(res, { doctor, schedule: await availability.getSchedule(doctor._id) });
});
exports.updateDoctorSchedule = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new AppError('Doctor not found', 404);
  await availability.saveAvailability(doctor, req.body);
  await logActivity(req.user, 'DOCTOR_SCHEDULE_UPDATED', `Doctor ${doctor._id}`, 'Doctor', doctor._id);
  sendSuccess(res, { doctor: await Doctor.findById(doctor._id).populate(DOC_POP), schedule: await availability.getSchedule(doctor._id) }, 'Schedule saved');
});

// ---------------------------------------------------------------- patients
exports.listPatients = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    const users = await User.find({ role: 'patient', $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select('_id');
    filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { patientCode: rx }];
  }
  const [items, total] = await Promise.all([Patient.find(filter).populate('user', 'name email phone profileImage isActive createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit), Patient.countDocuments(filter)]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});
exports.getPatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id).populate('user', 'name email phone profileImage isActive createdAt');
  if (!patient) throw new AppError('Patient not found', 404);
  const history = await Appointment.find({ patient: patient._id }).populate(POPULATE).sort({ startAt: -1 }).limit(20);
  sendSuccess(res, { patient, history });
});
exports.updatePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new AppError('Patient not found', 404);
  const user = await User.findById(patient.user);
  if (req.body.name !== undefined) user.name = req.body.name.trim();
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.body.isActive !== undefined) user.isActive = bool(req.body.isActive);
  await user.save();
  Object.assign(patient, pickPatientFields(req.body));
  await patient.save();
  await logActivity(req.user, 'PATIENT_UPDATED', user.email, 'Patient', patient._id);
  sendSuccess(res, { patient: await Patient.findById(patient._id).populate('user', 'name email phone isActive') }, 'Patient updated');
});

// ---------------------------------------------------------------- receptionists
exports.listReceptionists = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const [items, total] = await Promise.all([
    Receptionist.find().populate('user', 'name email phone isActive profileImage').populate('assignedDepartment', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Receptionist.countDocuments(),
  ]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});
exports.createReceptionist = asyncHandler(async (req, res) => {
  const b = req.body;
  for (const f of ['name', 'email', 'phone', 'employeeId']) if (!b[f]?.trim()) throw new AppError(`${f} is required`, 400);
  if (!/^\S+@\S+\.\S+$/.test(b.email)) throw new AppError('Enter a valid email', 400);
  await assertEmailFree(b.email);
  if (await Receptionist.exists({ employeeId: b.employeeId.trim() })) throw new AppError('Employee ID already exists', 409);
  const password = b.password || tempPassword();
  const user = await User.create({ name: b.name.trim(), email: b.email.trim().toLowerCase(), phone: b.phone, password, role: 'receptionist', isVerified: true });
  let rec;
  try { rec = await Receptionist.create({ user: user._id, employeeId: b.employeeId.trim(), assignedDepartment: b.assignedDepartment || undefined, joiningDate: b.joiningDate || undefined }); }
  catch (e) { await User.deleteOne({ _id: user._id }); throw e; }
  sendWelcomeCredentials(user, password, `${(process.env.CLIENT_URL || '').split(',')[0]}/receptionist/login`);
  await logActivity(req.user, 'RECEPTIONIST_CREATED', user.email, 'Receptionist', rec._id);
  sendSuccess(res, { receptionist: await Receptionist.findById(rec._id).populate('user', 'name email phone isActive'), temporaryPassword: b.password ? undefined : password }, 'Receptionist created', 201);
});
exports.updateReceptionist = asyncHandler(async (req, res) => {
  const rec = await Receptionist.findById(req.params.id);
  if (!rec) throw new AppError('Receptionist not found', 404);
  const user = await User.findById(rec.user);
  const b = req.body;
  if (b.name !== undefined) user.name = b.name.trim();
  if (b.phone !== undefined) user.phone = b.phone;
  if (b.isActive !== undefined) user.isActive = bool(b.isActive);
  await user.save();
  if (b.assignedDepartment !== undefined) rec.assignedDepartment = b.assignedDepartment || undefined;
  if (b.employeeId !== undefined && b.employeeId !== rec.employeeId) {
    if (await Receptionist.exists({ employeeId: b.employeeId, _id: { $ne: rec._id } })) throw new AppError('Employee ID already exists', 409);
    rec.employeeId = b.employeeId;
  }
  await rec.save();
  await logActivity(req.user, 'RECEPTIONIST_UPDATED', user.email, 'Receptionist', rec._id);
  sendSuccess(res, { receptionist: await Receptionist.findById(rec._id).populate('user', 'name email phone isActive').populate('assignedDepartment', 'name') }, 'Receptionist updated');
});

// ---------------------------------------------------------------- appointments, payments, reports
exports.appointments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = await svc.buildFilter(req.user, req.query);
  const sort = svc.SORTS[req.query.sort] || svc.SORTS.created_desc;
  const [items, total] = await Promise.all([Appointment.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit), Appointment.countDocuments(filter)]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});

exports.payments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.query.status) filter.paymentStatus = req.query.status;
  if (req.query.method) filter.paymentMethod = req.query.method;
  const [items, total, totals] = await Promise.all([
    Payment.find(filter).populate([{ path: 'patient', populate: { path: 'user', select: 'name email' } }, { path: 'appointment', select: 'appointmentCode appointmentDate startTime appointmentStatus', }]).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $group: { _id: '$paymentStatus', total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
  ]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total), summary: Object.fromEntries(totals.map((t) => [t._id, { total: t.total, count: t.n }])) });
});

const csvCell = (v) => {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

// GET /api/admin/reports/appointments?from=&to=&status=   (CSV download)
exports.exportAppointmentsCsv = asyncHandler(async (req, res) => {
  const filter = await svc.buildFilter(req.user, req.query);
  const rows = await Appointment.find(filter).populate(POPULATE).sort({ startAt: 1 }).limit(10000);
  const head = ['Appointment ID', 'Date', 'Start', 'End', 'Patient', 'Patient email', 'Doctor', 'Department', 'Status', 'Payment status', 'Payment method', 'Fee'];
  const lines = [head.map(csvCell).join(',')].concat(
    rows.map((a) => [a.appointmentCode, a.appointmentDate, a.startTime, a.endTime, a.patient?.user?.name, a.patient?.user?.email, a.doctor?.user?.name, a.department?.name, a.appointmentStatus, a.paymentStatus, a.paymentMethod, a.consultationFee].map(csvCell).join(','))
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="appointments-${localNow().date}.csv"`);
  res.send('\uFEFF' + lines.join('\n'));
});

// ---------------------------------------------------------------- settings, logs, announcements
exports.getSettings = asyncHandler(async (_req, res) => sendSuccess(res, { settings: await getSettings() }));
exports.updateSettings = asyncHandler(async (req, res) => {
  const s = await getSettings();
  const allowed = ['hospitalName', 'address', 'phone', 'email', 'about', 'emergencyNumber', 'workingHours', 'autoConfirmAppointments', 'cancellationDeadlineHours', 'rescheduleDeadlineHours', 'maxReschedules', 'maxAdvanceBookingDays', 'minLeadMinutes', 'reservationMinutes', 'cashPaymentEnabled', 'onlinePaymentEnabled', 'allowDoctorsToSetFee', 'emailNotificationsEnabled', 'reminderHoursBefore'];
  const numeric = ['cancellationDeadlineHours', 'rescheduleDeadlineHours', 'maxReschedules', 'maxAdvanceBookingDays', 'minLeadMinutes', 'reservationMinutes', 'reminderHoursBefore'];
  for (const k of allowed) {
    if (req.body[k] === undefined) continue;
    if (numeric.includes(k)) { const n = Number(req.body[k]); if (!(n >= 0)) throw new AppError(`${k} must be zero or more`, 400); s[k] = n; }
    else s[k] = typeof s[k] === 'boolean' ? bool(req.body[k]) : req.body[k];
  }
  if (!s.cashPaymentEnabled && !s.onlinePaymentEnabled) throw new AppError('At least one payment option must stay enabled', 400);
  if (s.reservationMinutes < 1) throw new AppError('Reservation hold must be at least 1 minute', 400);
  await s.save();
  await logActivity(req.user, 'SETTINGS_UPDATED', 'Hospital settings changed', 'Settings', s._id);
  sendSuccess(res, { settings: s }, 'Settings saved');
});

exports.logs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate({ limit: 25, ...req.query });
  const filter = {};
  if (req.query.action) filter.action = new RegExp(escapeRegex(req.query.action), 'i');
  const [items, total] = await Promise.all([ActivityLog.find(filter).populate('user', 'name role').sort({ createdAt: -1 }).skip(skip).limit(limit), ActivityLog.countDocuments(filter)]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});

// POST /api/admin/notifications/broadcast { title, message, audience: all|patient|doctor|receptionist }
exports.broadcast = asyncHandler(async (req, res) => {
  const { title, message, audience = 'all' } = req.body;
  if (!title?.trim() || !message?.trim()) throw new AppError('Title and message are required', 400);
  const filter = { isActive: true, ...(audience === 'all' ? { role: { $ne: 'admin' } } : { role: audience }) };
  if (!['all', 'patient', 'doctor', 'receptionist'].includes(audience)) throw new AppError('Invalid audience', 400);
  const ids = await User.find(filter).select('_id');
  await Notification.insertMany(ids.map((u) => ({ recipient: u._id, title: title.trim(), message: message.trim(), type: 'system' })));
  await logActivity(req.user, 'ANNOUNCEMENT_SENT', `${title} → ${audience} (${ids.length})`, 'Notification');
  sendSuccess(res, { sent: ids.length }, `Announcement sent to ${ids.length} user(s)`);
});

// GET /api/public/hospital  (public info for the website)
exports.publicInfo = asyncHandler(async (_req, res) => {
  const s = await getSettings();
  sendSuccess(res, { hospital: { name: s.hospitalName, address: s.address, phone: s.phone, email: s.email, about: s.about, emergencyNumber: s.emergencyNumber, workingHours: s.workingHours, cashPaymentEnabled: s.cashPaymentEnabled, onlinePaymentEnabled: s.onlinePaymentEnabled && require('../services/paymentService').isConfigured(), reservationMinutes: s.reservationMinutes, cancellationDeadlineHours: s.cancellationDeadlineHours } });
});

// POST /api/public/contact { name, email, phone, message }  -> in-app notification for every admin + email to the hospital
exports.contact = asyncHandler(async (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || !message?.trim()) throw new AppError('Name, a valid email and a message are required', 400);
  if (message.length > 2000) throw new AppError('Message is too long (2000 characters max)', 400);
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await Notification.insertMany(admins.map((a) => ({ recipient: a._id, title: `Contact message from ${name.trim()}`, message: `${message.trim().slice(0, 400)} — ${email}${phone ? ` / ${phone}` : ''}`, type: 'system' })));
  const settings = await getSettings();
  if (settings.email) require('../services/emailService').sendEmail({ to: settings.email, subject: `Website enquiry from ${name}`, title: 'New website enquiry', html: `<p><b>${name}</b> (${email}${phone ? `, ${phone}` : ''})</p><p>${String(message).replace(/</g, '&lt;')}</p>` });
  sendSuccess(res, {}, 'Thanks! Your message has been sent to our team.');
});
