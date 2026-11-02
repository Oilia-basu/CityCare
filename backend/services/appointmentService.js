// Appointment business logic: atomic booking, cancellation, rescheduling, status transitions, check-in, listing.
// Slot reservation relies on the partial unique index on Appointment.slotKey (see models/Appointment.js).
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { AppError, escapeRegex } = require('../utils/apiResponse');
const { POPULATE } = require('./appointmentPopulate');
const { getSettings } = require('./settingsService');
const availability = require('./availabilityService');
const paymentService = require('./paymentService');
const { notify } = require('./notificationService');
const { sendAppointmentEmail } = require('./emailService');
const { logActivity } = require('./activityService');
const { toUtc, localNow, isValidDate, isValidTime } = require('../utils/dateUtils');

const { ACTIVE_STATUSES } = Appointment;
const slotKeyOf = (doctorId, date, time) => `${doctorId}_${date}_${time}`;
const load = (id) => Appointment.findById(id).populate(POPULATE);

const TRANSITIONS = {
  Pending: ['Confirmed', 'Rejected', 'Cancelled'],
  Confirmed: ['Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show'],
  'Checked-In': ['In-Progress', 'Completed', 'Cancelled', 'No-Show'],
  'In-Progress': ['Completed'],
};
const ROLE_STATUSES = {
  doctor: ['Confirmed', 'Rejected', 'In-Progress', 'Completed', 'No-Show'],
  receptionist: ['Checked-In', 'No-Show', 'Cancelled'],
  admin: ['Confirmed', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'Rejected', 'No-Show'],
  patient: ['Cancelled'],
};

// ---------- access ----------
const assertAccess = (appt, user) => {
  if (['admin', 'receptionist'].includes(user.role)) return;
  if (user.role === 'patient' && String(appt.patient.user._id) === String(user._id)) return;
  if (user.role === 'doctor' && String(appt.doctor.user._id) === String(user._id)) return;
  throw new AppError('You do not have access to this appointment', 403);
};

const getAppointment = async (id, user) => {
  const appt = await load(id);
  if (!appt) throw new AppError('Appointment not found', 404);
  assertAccess(appt, user);
  return appt;
};

// ---------- reservation expiry ----------
const releaseExpiredReservations = async (extra = {}) => {
  const now = new Date();
  const expired = await Appointment.find({ appointmentStatus: 'Pending', paymentStatus: 'Pending', reservationExpiresAt: { $lt: now }, ...extra }).select('_id');
  let released = 0;
  for (const { _id } of expired) {
    const res = await Appointment.findOneAndUpdate(
      { _id, appointmentStatus: 'Pending', paymentStatus: 'Pending', reservationExpiresAt: { $lt: now } },
      { $set: { appointmentStatus: 'Cancelled', cancellationReason: 'Payment not completed in time', cancelledAt: now }, $unset: { slotKey: '', reservationExpiresAt: '' } },
      { new: true }
    ).populate(POPULATE);
    if (!res) continue;
    released += 1;
    await Payment.updateOne({ appointment: _id, paymentStatus: 'Pending' }, { paymentStatus: 'Failed' });
    await notify(res.patient.user._id, { title: 'Reservation expired', message: `Your slot for ${res.appointmentDate} ${res.startTime} was released because payment was not completed.`, type: 'payment_failure', appointment: res });
  }
  return released;
};

// ---------- create ----------
const createAppointment = async (actor, input) => {
  const { doctorId, date, startTime, reason, symptoms, patientId } = input;
  const settings = await getSettings();
  const method = input.paymentMethod === 'Online' ? 'Online' : 'Cash';
  if (method === 'Online' && !(settings.onlinePaymentEnabled && paymentService.isConfigured())) throw new AppError('Online payment is currently disabled', 400);
  if (method === 'Cash' && !settings.cashPaymentEnabled) throw new AppError('Pay-at-hospital is currently disabled', 400);

  // 1. patient (patients can only book for themselves; staff pass a patient profile id)
  let patient;
  if (actor.role === 'patient') patient = await Patient.findOne({ user: actor._id }).populate('user', 'name email phone isActive');
  else if (['receptionist', 'admin'].includes(actor.role)) {
    if (!patientId) throw new AppError('Select a patient', 400);
    patient = await Patient.findById(patientId).populate('user', 'name email phone isActive');
  } else throw new AppError('Doctors cannot book appointments', 403);
  if (!patient) throw new AppError('Patient profile not found', 404);
  if (!patient.user.isActive) throw new AppError('This patient account is deactivated', 403);

  // 2. doctor + department (fee always comes from the database)
  const doctor = await availability.loadDoctor(doctorId);
  const department = await require('../models/Department').findById(doctor.department);
  if (!department || !department.isActive) throw new AppError('This department is not accepting appointments', 400);

  // 3. free expired holds for this day, then re-verify the slot on the backend
  await releaseExpiredReservations({ doctor: doctor._id, appointmentDate: date });
  const slot = await availability.assertSlotBookable(doctor, date, startTime);

  // 4. a patient cannot hold two appointments at the same time
  const clash = await Appointment.exists({ patient: patient._id, appointmentDate: date, startTime, appointmentStatus: { $in: ACTIVE_STATUSES } });
  if (clash) throw new AppError('You already have an appointment at this time.', 409);

  const fee = doctor.consultationFee;
  const free = fee === 0;
  const isOnline = method === 'Online' && !free;
  const status = isOnline ? 'Pending' : settings.autoConfirmAppointments ? 'Confirmed' : 'Pending';

  let appt;
  try {
    appt = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      department: department._id,
      appointmentDate: date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      startAt: toUtc(date, slot.startTime),
      reason,
      symptoms,
      consultationFee: fee,
      appointmentStatus: status,
      paymentStatus: free ? 'Paid' : 'Pending',
      paymentMethod: isOnline ? 'Online' : 'Cash',
      bookedBy: actor._id,
      slotKey: slotKeyOf(doctor._id, date, slot.startTime), // atomic reservation
      reservationExpiresAt: isOnline ? new Date(Date.now() + settings.reservationMinutes * 60000) : undefined,
    });
  } catch (e) {
    if (e.code === 11000) throw new AppError('That slot has just been booked by someone else. Please choose another.', 409);
    throw e;
  }

  const payment = await Payment.create({
    patient: patient._id,
    appointment: appt._id,
    amount: fee,
    paymentMethod: isOnline ? 'Online' : 'Cash',
    paymentStatus: free ? 'Paid' : 'Pending',
    paidAt: free ? new Date() : undefined,
  });
  appt.payment = payment._id;
  await appt.save();

  const full = await load(appt._id);
  await notify(patient.user._id, {
    title: status === 'Confirmed' ? 'Appointment confirmed' : isOnline ? 'Slot reserved – complete payment' : 'Appointment requested',
    message: `${doctor.user.name} • ${date} at ${slot.startTime}${isOnline ? ` (pay within ${settings.reservationMinutes} min)` : ''}`,
    type: status === 'Confirmed' ? 'confirmation' : 'booking',
    appointment: appt,
  });
  if (!isOnline) {
    await notify(doctor.user._id, { title: status === 'Confirmed' ? 'New appointment' : 'New appointment request', message: `${patient.user.name} • ${date} at ${slot.startTime}`, type: 'booking', appointment: appt });
    sendAppointmentEmail('booked', full);
  }
  await logActivity(actor, 'APPOINTMENT_BOOKED', `${full.appointmentCode} with ${doctor.user.name} on ${date} ${slot.startTime}`, 'Appointment', appt._id);
  return full;
};

// ---------- cancel ----------
const cancelAppointment = async (actor, id, reason) => {
  const appt = await getAppointment(id, actor);
  const cancellable = actor.role === 'patient' ? ['Pending', 'Confirmed'] : ['Pending', 'Confirmed', 'Checked-In'];
  if (appt.appointmentStatus === 'Completed') throw new AppError('Completed appointments cannot be cancelled', 400);
  if (!cancellable.includes(appt.appointmentStatus)) throw new AppError(`A ${appt.appointmentStatus} appointment cannot be cancelled`, 400);

  const settings = await getSettings();
  if (actor.role === 'patient' && appt.appointmentStatus === 'Confirmed') {
    const hours = (appt.startAt - Date.now()) / 3600000;
    if (hours < settings.cancellationDeadlineHours) throw new AppError(`Appointments can only be cancelled at least ${settings.cancellationDeadlineHours} hours before the start time.`, 400);
  }
  if (actor.role === 'doctor' && !reason) throw new AppError('Please provide a reason', 400);

  const updated = await Appointment.findOneAndUpdate(
    { _id: appt._id, appointmentStatus: { $in: cancellable } },
    { $set: { appointmentStatus: 'Cancelled', cancelledBy: actor._id, cancelledAt: new Date(), cancellationReason: reason || 'Cancelled by ' + actor.role }, $unset: { slotKey: '', reservationExpiresAt: '' } },
    { new: true }
  );
  if (!updated) throw new AppError('This appointment was just updated. Refresh and try again.', 409);

  await settlePaymentOnRelease(appt._id, 'Appointment cancelled');
  const full = await load(appt._id);
  const msg = `${full.appointmentCode} • ${full.appointmentDate} ${full.startTime}${reason ? ` — ${reason}` : ''}`;
  await notify(full.patient.user._id, { title: 'Appointment cancelled', message: msg, type: 'cancellation', appointment: full });
  await notify(full.doctor.user._id, { title: 'Appointment cancelled', message: msg, type: 'cancellation', appointment: full });
  sendAppointmentEmail('cancelled', full);
  await logActivity(actor, 'APPOINTMENT_CANCELLED', msg, 'Appointment', full._id);
  return full;
};

// Refund when already paid; mark unpaid online attempts as failed.
const settlePaymentOnRelease = async (appointmentId, reason) => {
  const payment = await Payment.findOne({ appointment: appointmentId });
  if (!payment) return;
  if (payment.paymentStatus === 'Paid') {
    try { await paymentService.refundPayment(payment, reason); } catch (e) { console.error('Refund failed (retry from admin → payments):', e.message); }
  } else if (payment.paymentStatus === 'Pending') {
    payment.paymentStatus = 'Failed';
    await payment.save();
    await Appointment.updateOne({ _id: appointmentId }, { paymentStatus: 'Failed' });
  }
};

// ---------- reschedule ----------
const rescheduleAppointment = async (actor, id, { date, startTime }) => {
  if (actor.role === 'doctor') throw new AppError('Doctors cannot reschedule appointments', 403);
  const appt = await getAppointment(id, actor);
  if (!['Pending', 'Confirmed'].includes(appt.appointmentStatus)) throw new AppError(`A ${appt.appointmentStatus} appointment cannot be rescheduled`, 400);
  if (appt.paymentMethod === 'Online' && appt.paymentStatus !== 'Paid') throw new AppError('Complete payment before rescheduling', 400);
  if (appt.appointmentDate === date && appt.startTime === startTime) throw new AppError('Choose a different time', 400);

  const settings = await getSettings();
  if (actor.role === 'patient') {
    const hours = (appt.startAt - Date.now()) / 3600000;
    if (hours < settings.rescheduleDeadlineHours) throw new AppError(`Appointments can only be rescheduled at least ${settings.rescheduleDeadlineHours} hours before the start time.`, 400);
    if (appt.rescheduleCount >= settings.maxReschedules) throw new AppError(`You can reschedule an appointment at most ${settings.maxReschedules} times.`, 400);
  }

  const doctor = await availability.loadDoctor(appt.doctor._id);
  await releaseExpiredReservations({ doctor: doctor._id, appointmentDate: date });
  const slot = await availability.assertSlotBookable(doctor, date, startTime);
  const clash = await Appointment.exists({ _id: { $ne: appt._id }, patient: appt.patient._id, appointmentDate: date, startTime, appointmentStatus: { $in: ACTIVE_STATUSES } });
  if (clash) throw new AppError('The patient already has an appointment at this time.', 409);

  const previous = `${appt.appointmentDate} ${appt.startTime}`;
  let updated;
  try {
    // ONE atomic update: reserves the new slot (unique index) and releases the old one (slotKey replaced).
    updated = await Appointment.findOneAndUpdate(
      { _id: appt._id, appointmentStatus: { $in: ['Pending', 'Confirmed'] } },
      {
        $set: { appointmentDate: date, startTime: slot.startTime, endTime: slot.endTime, startAt: toUtc(date, slot.startTime), slotKey: slotKeyOf(doctor._id, date, slot.startTime), reminderSent: false },
        $inc: { rescheduleCount: 1 },
      },
      { new: true }
    );
  } catch (e) {
    if (e.code === 11000) throw new AppError('That slot has just been booked by someone else. Please choose another.', 409);
    throw e;
  }
  if (!updated) throw new AppError('This appointment was just updated. Refresh and try again.', 409);

  const full = await load(appt._id);
  const msg = `${full.appointmentCode}: ${previous} → ${full.appointmentDate} ${full.startTime}`;
  await notify(full.patient.user._id, { title: 'Appointment rescheduled', message: msg, type: 'reschedule', appointment: full });
  await notify(full.doctor.user._id, { title: 'Appointment rescheduled', message: msg, type: 'reschedule', appointment: full });
  sendAppointmentEmail('rescheduled', full);
  await logActivity(actor, 'APPOINTMENT_RESCHEDULED', msg, 'Appointment', full._id);
  return full;
};

// ---------- check-in ----------
const checkIn = async (actor, id) => {
  if (!['receptionist', 'admin'].includes(actor.role)) throw new AppError('Only reception staff can check patients in', 403);
  const appt = await getAppointment(id, actor);
  if (appt.appointmentStatus !== 'Confirmed') throw new AppError(`Only confirmed appointments can be checked in (current: ${appt.appointmentStatus})`, 400);
  if (appt.appointmentDate !== localNow().date) throw new AppError('Check-in is only available on the day of the appointment', 400);

  const last = await Appointment.findOne({ doctor: appt.doctor._id, appointmentDate: appt.appointmentDate, queueNumber: { $exists: true } }).sort({ queueNumber: -1 }).select('queueNumber');
  const updated = await Appointment.findOneAndUpdate(
    { _id: appt._id, appointmentStatus: 'Confirmed' },
    { $set: { appointmentStatus: 'Checked-In', checkedInAt: new Date(), queueNumber: (last?.queueNumber || 0) + 1 } },
    { new: true }
  );
  if (!updated) throw new AppError('This appointment was just updated. Refresh and try again.', 409);
  const full = await load(appt._id);
  await notify(full.doctor.user._id, { title: 'Patient checked in', message: `${full.patient.user.name} (queue #${full.queueNumber})`, type: 'status', appointment: full });
  await notify(full.patient.user._id, { title: 'You are checked in', message: `Your queue number is #${full.queueNumber}.`, type: 'status', appointment: full });
  await logActivity(actor, 'PATIENT_CHECKED_IN', `${full.appointmentCode} queue #${full.queueNumber}`, 'Appointment', full._id);
  return full;
};

// ---------- status ----------
const updateStatus = async (actor, id, { status, notes, reason }) => {
  if (status === 'Cancelled') return cancelAppointment(actor, id, reason);
  if (status === 'Checked-In') return checkIn(actor, id);
  if (!ROLE_STATUSES[actor.role]?.includes(status)) throw new AppError(`Your role cannot set status "${status}"`, 403);

  const appt = await getAppointment(id, actor);
  const from = appt.appointmentStatus;
  if (!(TRANSITIONS[from] || []).includes(status)) throw new AppError(`Cannot change status from ${from} to ${status}`, 400);
  if (status === 'Rejected' && !reason) throw new AppError('Please provide a reason for rejecting', 400);
  if (status === 'Confirmed' && appt.paymentMethod === 'Online' && appt.paymentStatus !== 'Paid') throw new AppError('Payment has not been received for this appointment', 400);
  if (['In-Progress', 'Completed'].includes(status) && appt.startAt > new Date(Date.now() + 15 * 60000) && from !== 'Checked-In') {
    throw new AppError('This consultation cannot be started before its scheduled time', 400);
  }

  const $set = { appointmentStatus: status };
  const $unset = {};
  if (notes !== undefined && ['doctor', 'admin'].includes(actor.role)) $set.consultationNotes = String(notes).slice(0, 3000);
  if (status === 'Completed') $set.completedAt = new Date();
  if (status === 'Rejected') {
    $set.cancellationReason = reason;
    $set.cancelledBy = actor._id;
    $set.cancelledAt = new Date();
    $unset.slotKey = '';
    $unset.reservationExpiresAt = '';
  }
  const updated = await Appointment.findOneAndUpdate({ _id: appt._id, appointmentStatus: from }, Object.keys($unset).length ? { $set, $unset } : { $set }, { new: true });
  if (!updated) throw new AppError('This appointment was just updated. Refresh and try again.', 409);

  if (status === 'Rejected') await settlePaymentOnRelease(appt._id, 'Rejected by doctor');
  const full = await load(appt._id);
  const patientMsg = {
    Confirmed: ['Appointment confirmed', 'confirmation'],
    Rejected: ['Appointment declined', 'status'],
    'In-Progress': ['Consultation started', 'status'],
    Completed: ['Consultation completed', 'completion'],
    'No-Show': ['Marked as no-show', 'status'],
  }[status];
  await notify(full.patient.user._id, { title: patientMsg[0], message: `${full.appointmentCode} • ${full.appointmentDate} ${full.startTime}${reason ? ` — ${reason}` : ''}`, type: patientMsg[1], appointment: full });
  if (status === 'Confirmed') sendAppointmentEmail('confirmed', full);
  if (status === 'Rejected') sendAppointmentEmail('rejected', full);
  if (status === 'Completed') sendAppointmentEmail('completed', full);
  await logActivity(actor, `APPOINTMENT_${status.toUpperCase().replace('-', '_')}`, `${full.appointmentCode}: ${from} → ${status}`, 'Appointment', full._id);
  return full;
};

// ---------- list ----------
const buildFilter = async (user, q) => {
  const filter = {};
  if (user.role === 'patient') {
    const p = await Patient.findOne({ user: user._id }).select('_id');
    filter.patient = p?._id || null;
  } else if (user.role === 'doctor') {
    const d = await Doctor.findOne({ user: user._id }).select('_id');
    filter.doctor = d?._id || null;
  } else {
    if (q.doctorId) filter.doctor = q.doctorId;
    if (q.patientId) filter.patient = q.patientId;
  }
  if (q.status) filter.appointmentStatus = { $in: String(q.status).split(',') };
  if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;
  if (q.date && isValidDate(q.date)) filter.appointmentDate = q.date;
  else if ((q.from && isValidDate(q.from)) || (q.to && isValidDate(q.to))) {
    filter.appointmentDate = {};
    if (q.from && isValidDate(q.from)) filter.appointmentDate.$gte = q.from;
    if (q.to && isValidDate(q.to)) filter.appointmentDate.$lte = q.to;
  }
  if (q.when === 'upcoming') {
    filter.appointmentStatus = { $in: ['Pending', 'Confirmed', 'Checked-In', 'In-Progress'] };
    filter.startAt = { $gte: new Date(Date.now() - 60 * 60000) };
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(String(q.search).trim()), 'i');
    const users = await User.find({ name: rx, role: { $in: ['patient', 'doctor'] } }).select('_id');
    const ids = users.map((u) => u._id);
    const [pats, docs] = await Promise.all([Patient.find({ user: { $in: ids } }).select('_id'), Doctor.find({ user: { $in: ids } }).select('_id')]);
    filter.$or = [{ appointmentCode: rx }, { patient: { $in: pats.map((p) => p._id) } }, { doctor: { $in: docs.map((d) => d._id) } }];
  }
  return filter;
};

const SORTS = { date_asc: { startAt: 1 }, date_desc: { startAt: -1 }, created_desc: { createdAt: -1 } };

module.exports = {
  createAppointment, cancelAppointment, rescheduleAppointment, updateStatus, checkIn, getAppointment, buildFilter,
  releaseExpiredReservations, assertAccess, load, SORTS, ACTIVE_STATUSES, TRANSITIONS,
};
