const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const { asyncHandler, sendSuccess, paginate, pageMeta, AppError, escapeRegex } = require('../utils/apiResponse');
const { POPULATE } = require('../services/appointmentPopulate');
const availability = require('../services/availabilityService');
const { buildFilter, SORTS } = require('../services/appointmentService');
const { applyProfileImage } = require('../services/profileService');
const { getSettings } = require('../services/settingsService');
const { logActivity } = require('../services/activityService');
const { localNow, isValidDate } = require('../utils/dateUtils');

const DOC_POP = [{ path: 'user', select: 'name email phone profileImage isActive' }, { path: 'department', select: 'name' }];
const PUBLIC_FIELDS = '-licenseNumber -blockedDates -leaves';

// GET /api/doctors?search=&specialization=&department=&minRating=&sort=&page=&limit=   (public: only active + verified)
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate({ limit: 12, ...req.query });
  const { search, specialization, department, minRating, sort } = req.query;
  const users = await User.find({ role: 'doctor', isActive: true }).select('_id name');
  const filter = { user: { $in: users.map((u) => u._id) }, isVerified: true };
  if (specialization) filter.specialization = new RegExp(`^${escapeRegex(specialization)}$`, 'i');
  if (department) filter.department = department;
  if (minRating) filter.averageRating = { $gte: Number(minRating) };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const ids = users.filter((u) => rx.test(u.name)).map((u) => u._id);
    filter.$or = [{ user: { $in: ids } }, { specialization: rx }];
  }
  const sortMap = { rating: { averageRating: -1 }, fee_asc: { consultationFee: 1 }, fee_desc: { consultationFee: -1 }, experience: { experience: -1 } };
  const [items, total] = await Promise.all([
    Doctor.find(filter).select(PUBLIC_FIELDS).populate(DOC_POP).sort(sortMap[sort] || { createdAt: -1 }).skip(skip).limit(limit),
    Doctor.countDocuments(filter),
  ]);
  const specializations = await Doctor.distinct('specialization', { isVerified: true, user: { $in: users.map((u) => u._id) } });
  sendSuccess(res, { items, meta: pageMeta(page, limit, total), specializations: specializations.sort() });
});

// GET /api/doctors/:id  (public)
exports.getById = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).select(PUBLIC_FIELDS).populate(DOC_POP);
  if (!doctor || !doctor.user?.isActive || !doctor.isVerified) throw new AppError('Doctor not found', 404);
  const [schedule, reviews] = await Promise.all([
    availability.getSchedule(doctor._id),
    Review.find({ doctor: doctor._id }).populate({ path: 'patient', populate: { path: 'user', select: 'name' } }).sort({ createdAt: -1 }).limit(10),
  ]);
  const safeReviews = reviews.map((r) => ({ _id: r._id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, patientName: r.patient?.user?.name?.split(' ')[0] || 'Patient' }));
  sendSuccess(res, { doctor, schedule: schedule.filter((s) => s.isActive), reviews: safeReviews });
});

// GET /api/doctors/:id/availability?date=YYYY-MM-DD  (public)
exports.availability = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (date) return sendSuccess(res, await availability.getSlots(req.params.id, date));
  const doctor = await availability.loadDoctor(req.params.id);
  const schedule = await availability.getSchedule(doctor._id);
  sendSuccess(res, {
    schedule: schedule.filter((s) => s.isActive), blockedDates: doctor.blockedDates, leaves: doctor.leaves,
    isAvailable: doctor.isAvailable, today: localNow().date,
  });
});

const myDoctor = async (user) => {
  const d = await Doctor.findOne({ user: user._id }).populate(DOC_POP);
  if (!d) throw new AppError('Doctor profile not found', 404);
  return d;
};
exports.myDoctor = myDoctor;

// GET /api/doctors/profile
exports.getProfile = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req.user);
  const schedule = await availability.getSchedule(doctor._id);
  const settings = await getSettings();
  sendSuccess(res, { user: req.user, profile: doctor, schedule, canEditFee: settings.allowDoctorsToSetFee });
});

// PUT /api/doctors/profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req.user);
  const settings = await getSettings();
  const b = req.body;
  if (b.name !== undefined) { if (!String(b.name).trim()) throw new AppError('Name cannot be empty', 400); req.user.name = String(b.name).trim(); }
  if (b.phone !== undefined) req.user.phone = b.phone;
  await applyProfileImage(req.user, req.file);
  await req.user.save();
  ['biography', 'qualification'].forEach((k) => { if (b[k] !== undefined) doctor[k] = b[k]; });
  if (b.experience !== undefined) { const n = Number(b.experience); if (!(n >= 0)) throw new AppError('Experience must be a positive number', 400); doctor.experience = n; }
  if (b.consultationFee !== undefined && Number(b.consultationFee) !== doctor.consultationFee) {
    if (!settings.allowDoctorsToSetFee) throw new AppError('Consultation fees are set by the hospital administrator.', 403);
    const fee = Number(b.consultationFee);
    if (!(fee >= 0)) throw new AppError('Invalid fee', 400);
    doctor.consultationFee = fee;
  }
  await doctor.save();
  await logActivity(req.user, 'PROFILE_UPDATED', 'Doctor profile updated', 'Doctor', doctor._id);
  sendSuccess(res, { user: req.user, profile: await myDoctor(req.user) }, 'Profile updated');
});

// PUT /api/doctors/availability   { schedule, blockedDates, leaves, isAvailable }
exports.updateAvailability = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req.user);
  await availability.saveAvailability(doctor, req.body);
  await logActivity(req.user, 'AVAILABILITY_UPDATED', 'Doctor updated schedule', 'Doctor', doctor._id);
  sendSuccess(res, { profile: await myDoctor(req.user), schedule: await availability.getSchedule(doctor._id) }, 'Availability saved');
});

// GET /api/doctors/dashboard
exports.dashboard = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req.user);
  const today = localNow().date;
  const base = { doctor: doctor._id };
  const [counts, todays, upcoming, requests, unread] = await Promise.all([
    Appointment.aggregate([{ $match: base }, { $group: { _id: '$appointmentStatus', n: { $sum: 1 } } }]),
    Appointment.find({ ...base, appointmentDate: today, appointmentStatus: { $nin: ['Cancelled', 'Rejected'] } }).populate(POPULATE).sort({ startTime: 1 }),
    Appointment.find({ ...base, appointmentDate: { $gt: today }, appointmentStatus: { $in: ['Pending', 'Confirmed'] } }).populate(POPULATE).sort({ startAt: 1 }).limit(6),
    Appointment.find({ ...base, appointmentStatus: 'Pending', paymentStatus: { $in: ['Paid'] } }).populate(POPULATE).sort({ startAt: 1 }).limit(10),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);
  // Cash requests (no payment needed up-front) must also appear as requests
  const cashRequests = await Appointment.find({ ...base, appointmentStatus: 'Pending', paymentMethod: 'Cash' }).populate(POPULATE).sort({ startAt: 1 }).limit(10);
  const merged = [...requests, ...cashRequests.filter((c) => !requests.some((r) => String(r._id) === String(c._id)))].sort((a, b) => a.startAt - b.startAt);
  const by = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  sendSuccess(res, {
    profile: doctor,
    stats: {
      total: counts.reduce((s, c) => s + c.n, 0), pending: by.Pending || 0, upcoming: (by.Confirmed || 0) + (by['Checked-In'] || 0),
      completed: by.Completed || 0, cancelled: (by.Cancelled || 0) + (by.Rejected || 0),
    },
    today: todays, upcoming, requests: merged, unreadNotifications: unread,
  });
});

// GET /api/doctors/appointments
exports.appointments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = await buildFilter(req.user, req.query);
  const sort = SORTS[req.query.sort] || SORTS.date_asc;
  const [items, total] = await Promise.all([Appointment.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit), Appointment.countDocuments(filter)]);
  sendSuccess(res, { items, meta: pageMeta(page, limit, total) });
});

// GET /api/doctors/patients/:patientId  - patient details + history, only for patients who have an appointment with this doctor
exports.patientDetails = asyncHandler(async (req, res) => {
  const doctor = await myDoctor(req.user);
  const link = await Appointment.exists({ doctor: doctor._id, patient: req.params.patientId });
  if (!link) throw new AppError('You can only view patients who have booked with you', 403);
  const patient = await Patient.findById(req.params.patientId).populate('user', 'name email phone profileImage');
  const history = await Appointment.find({ doctor: doctor._id, patient: patient._id }).populate(POPULATE).sort({ startAt: -1 }).limit(30);
  sendSuccess(res, { patient, history });
});
