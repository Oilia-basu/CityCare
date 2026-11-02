const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const { asyncHandler, sendSuccess, paginate, pageMeta, AppError } = require('../utils/apiResponse');
const { POPULATE } = require('../services/appointmentPopulate');
const { buildFilter, SORTS } = require('../services/appointmentService');
const { getProfile, pickPatientFields, applyProfileImage } = require('../services/profileService');
const { logActivity } = require('../services/activityService');

// GET /api/patients/profile
exports.getProfile = asyncHandler(async (req, res) => sendSuccess(res, { user: req.user, profile: await getProfile(req.user) }));

// PUT /api/patients/profile  (multipart/form-data allowed; field "image")
exports.updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const b = req.body;
  if (b.emergencyContact && typeof b.emergencyContact === 'string') { try { b.emergencyContact = JSON.parse(b.emergencyContact); } catch { delete b.emergencyContact; } }
  if (b.name !== undefined) { if (!String(b.name).trim()) throw new AppError('Name cannot be empty', 400); user.name = String(b.name).trim(); }
  if (b.phone !== undefined) user.phone = b.phone;
  await applyProfileImage(user, req.file);
  await user.save();
  const patient = await getProfile(user);
  Object.assign(patient, pickPatientFields(b));
  await patient.save();
  await logActivity(user, 'PROFILE_UPDATED', 'Patient profile updated', 'User', user._id);
  sendSuccess(res, { user, profile: patient }, 'Profile updated');
});

// GET /api/patients/appointments
exports.appointments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = await buildFilter(req.user, req.query);
  const sort = SORTS[req.query.sort] || SORTS.date_desc;
  const [items, total] = await Promise.all([Appointment.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit), Appointment.countDocuments(filter)]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});

// GET /api/patients/dashboard
exports.dashboard = asyncHandler(async (req, res) => {
  const patient = await getProfile(req.user);
  const base = { patient: patient._id };
  const [upcoming, counts, recent, unread, spent] = await Promise.all([
    Appointment.find({ ...base, appointmentStatus: { $in: ['Pending', 'Confirmed', 'Checked-In', 'In-Progress'] }, startAt: { $gte: new Date(Date.now() - 3600000) } }).populate(POPULATE).sort({ startAt: 1 }).limit(5),
    Appointment.aggregate([{ $match: base }, { $group: { _id: '$appointmentStatus', n: { $sum: 1 } } }]),
    Appointment.find({ ...base, appointmentStatus: { $in: ['Completed', 'Cancelled', 'Rejected', 'No-Show'] } }).populate(POPULATE).sort({ startAt: -1 }).limit(5),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    Payment.aggregate([{ $match: { patient: patient._id, paymentStatus: 'Paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  sendSuccess(res, {
    profile: patient,
    stats: {
      total: counts.reduce((s, c) => s + c.n, 0),
      upcoming: (byStatus.Pending || 0) + (byStatus.Confirmed || 0) + (byStatus['Checked-In'] || 0) + (byStatus['In-Progress'] || 0),
      completed: byStatus.Completed || 0,
      cancelled: (byStatus.Cancelled || 0) + (byStatus.Rejected || 0),
      totalPaid: spent[0]?.total || 0,
    },
    upcoming, recent, unreadNotifications: unread,
  });
});
