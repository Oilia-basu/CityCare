const Review = require('../models/Review');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const { asyncHandler, sendSuccess, AppError, paginate, pageMeta } = require('../utils/apiResponse');

// POST /api/reviews { appointmentId, rating, comment }   only the patient of a COMPLETED appointment, once
exports.create = asyncHandler(async (req, res) => {
  const { appointmentId, rating, comment } = req.body;
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) throw new AppError('Rating must be between 1 and 5', 400);
  const patient = await Patient.findOne({ user: req.user._id });
  const appt = await Appointment.findById(appointmentId);
  if (!appt || String(appt.patient) !== String(patient?._id)) throw new AppError('Appointment not found', 404);
  if (appt.appointmentStatus !== 'Completed') throw new AppError('You can only review completed consultations', 400);
  if (await Review.exists({ appointment: appt._id })) throw new AppError('You have already reviewed this appointment', 409);

  const review = await Review.create({ patient: patient._id, doctor: appt.doctor, appointment: appt._id, rating: r, comment: String(comment || '').slice(0, 1000) });
  await Appointment.updateOne({ _id: appt._id }, { isReviewed: true });
  const [agg] = await Review.aggregate([{ $match: { doctor: appt.doctor } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Doctor.updateOne({ _id: appt.doctor }, { averageRating: Math.round(agg.avg * 10) / 10, ratingCount: agg.n });
  sendSuccess(res, { review }, 'Thank you for your feedback', 201);
});

// GET /api/reviews/doctor/:doctorId  (public)
exports.forDoctor = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = { doctor: req.params.doctorId };
  const [items, total] = await Promise.all([
    Review.find(filter).populate({ path: 'patient', populate: { path: 'user', select: 'name' } }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);
  const safe = items.map((r) => ({ _id: r._id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, patientName: r.patient?.user?.name?.split(' ')[0] || 'Patient' }));
  sendSuccess(res, { items: safe, meta: pageMeta(page, limit, total) });
});
