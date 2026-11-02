// Dynamic slot generation. Slots are derived from the doctor's weekly schedule, minus breaks, blocked dates, leaves,
// already-reserved slots, capacity, and anything in the past.
const Doctor = require('../models/Doctor');
const DoctorSchedule = require('../models/DoctorSchedule');
const Appointment = require('../models/Appointment');
const { AppError } = require('../utils/apiResponse');
const { getSettings } = require('./settingsService');
const { isValidDate, toMinutes, toTime, toUtc, localNow, dayOfWeek, addDays } = require('../utils/dateUtils');

const buildSlots = (s) => {
  const start = toMinutes(s.startTime);
  const end = toMinutes(s.endTime);
  const dur = s.slotDuration;
  const bs = s.breakStart ? toMinutes(s.breakStart) : null;
  const be = s.breakEnd ? toMinutes(s.breakEnd) : null;
  const out = [];
  for (let t = start; t + dur <= end; t += dur) {
    if (bs !== null && be !== null && t < be && t + dur > bs) continue; // overlaps the break
    out.push({ startTime: toTime(t), endTime: toTime(t + dur) });
  }
  return out;
};

const bookingBlocker = (doctor) => {
  if (!doctor.user?.isActive) return 'This doctor is currently inactive.';
  if (!doctor.isVerified) return 'This doctor’s profile is awaiting verification.';
  if (!doctor.isAvailable) return 'This doctor is not accepting appointments right now.';
  return null;
};

const loadDoctor = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId).populate('user', 'name isActive');
  if (!doctor) throw new AppError('Doctor not found', 404);
  return doctor;
};

/**
 * Returns { date, bookable, reason, slots:[{startTime,endTime,available}] } for a doctor on a date.
 */
const getSlots = async (doctorId, date, doctorDoc) => {
  if (!isValidDate(date)) throw new AppError('Date must be in YYYY-MM-DD format', 400);
  const doctor = doctorDoc || (await loadDoctor(doctorId));
  const settings = await getSettings();
  const base = { date, doctorId: String(doctor._id), fee: doctor.consultationFee, slots: [] };

  const blocker = bookingBlocker(doctor);
  if (blocker) return { ...base, bookable: false, reason: blocker };

  const now = localNow();
  if (date < now.date) return { ...base, bookable: false, reason: 'Please choose today or a future date.' };
  if (date > addDays(now.date, settings.maxAdvanceBookingDays)) {
    return { ...base, bookable: false, reason: `Appointments can be booked up to ${settings.maxAdvanceBookingDays} days in advance.` };
  }
  if ((doctor.blockedDates || []).some((b) => b.date === date)) return { ...base, bookable: false, reason: 'The doctor is unavailable on this date.' };
  if ((doctor.leaves || []).some((l) => l.from <= date && date <= l.to)) return { ...base, bookable: false, reason: 'The doctor is on leave on this date.' };

  const schedule = await DoctorSchedule.findOne({ doctor: doctor._id, dayOfWeek: dayOfWeek(date), isActive: true });
  if (!schedule) return { ...base, bookable: false, reason: 'The doctor does not work on this day.' };

  const nowDate = new Date();
  const taken = await Appointment.find({
    doctor: doctor._id,
    appointmentDate: date,
    slotKey: { $type: 'string' },
    $or: [{ reservationExpiresAt: null }, { reservationExpiresAt: { $gt: nowDate } }],
  }).select('startTime');
  const takenSet = new Set(taken.map((a) => a.startTime));
  const full = taken.length >= schedule.maxPatientsPerDay;
  const earliest = new Date(nowDate.getTime() + settings.minLeadMinutes * 60000);

  const slots = buildSlots(schedule).map((s) => ({
    ...s,
    available: !full && !takenSet.has(s.startTime) && toUtc(date, s.startTime) > earliest,
  }));

  return {
    ...base,
    bookable: true,
    reason: slots.some((s) => s.available) ? null : full ? 'The daily appointment capacity has been reached.' : 'No free slots remain on this date.',
    slotDuration: schedule.slotDuration,
    workingHours: { start: schedule.startTime, end: schedule.endTime, breakStart: schedule.breakStart, breakEnd: schedule.breakEnd },
    slots,
  };
};

// Validates one concrete slot and returns it. Throws AppError if it cannot be booked.
const assertSlotBookable = async (doctor, date, startTime) => {
  const result = await getSlots(doctor._id, date, doctor);
  if (!result.bookable) throw new AppError(result.reason, 400);
  const slot = result.slots.find((s) => s.startTime === startTime);
  if (!slot) throw new AppError('That time is not a valid slot for this doctor.', 400);
  if (!slot.available) throw new AppError('That slot is no longer available. Please choose another.', 409);
  return slot;
};

// Keeps Doctor.availableDays in sync with active schedule rows.
const syncAvailableDays = async (doctorId) => {
  const days = await DoctorSchedule.find({ doctor: doctorId, isActive: true }).distinct('dayOfWeek');
  await Doctor.updateOne({ _id: doctorId }, { availableDays: days.sort() });
};

const validateScheduleRow = (r) => {
  const { dayOfWeek: d, startTime, endTime, slotDuration = 30, breakStart, breakEnd } = r;
  const isT = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
  if (!Number.isInteger(d) || d < 0 || d > 6) throw new AppError('Invalid weekday in schedule', 400);
  if (!isT(startTime) || !isT(endTime) || toMinutes(startTime) >= toMinutes(endTime)) throw new AppError('Schedule start time must be before end time', 400);
  if (!Number.isInteger(slotDuration) || slotDuration < 5 || slotDuration > 240) throw new AppError('Slot duration must be between 5 and 240 minutes', 400);
  if (breakStart || breakEnd) {
    if (!isT(breakStart) || !isT(breakEnd) || toMinutes(breakStart) >= toMinutes(breakEnd)) throw new AppError('Invalid break period', 400);
    if (toMinutes(breakStart) < toMinutes(startTime) || toMinutes(breakEnd) > toMinutes(endTime)) throw new AppError('Break must fall inside working hours', 400);
  }
};

// Replaces a doctor's weekly schedule + blocked dates/leaves.
const saveAvailability = async (doctor, { schedule, blockedDates, leaves, isAvailable }) => {
  if (Array.isArray(schedule)) {
    const seen = new Set();
    schedule.forEach((r) => {
      validateScheduleRow(r);
      if (seen.has(r.dayOfWeek)) throw new AppError('Each weekday can only appear once', 400);
      seen.add(r.dayOfWeek);
    });
    await DoctorSchedule.deleteMany({ doctor: doctor._id });
    if (schedule.length) {
      await DoctorSchedule.insertMany(
        schedule.map((r) => ({
          doctor: doctor._id,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          slotDuration: r.slotDuration || 30,
          breakStart: r.breakStart || undefined,
          breakEnd: r.breakEnd || undefined,
          maxPatientsPerDay: r.maxPatientsPerDay || 50,
          isActive: r.isActive !== false,
        }))
      );
    }
  }
  if (Array.isArray(blockedDates)) {
    blockedDates.forEach((b) => { if (!isValidDate(b.date)) throw new AppError('Blocked dates must be YYYY-MM-DD', 400); });
    doctor.blockedDates = blockedDates.map((b) => ({ date: b.date, reason: String(b.reason || '').slice(0, 200) }));
  }
  if (Array.isArray(leaves)) {
    leaves.forEach((l) => {
      if (!isValidDate(l.from) || !isValidDate(l.to) || l.from > l.to) throw new AppError('Leave dates are invalid', 400);
    });
    doctor.leaves = leaves.map((l) => ({ from: l.from, to: l.to, reason: String(l.reason || '').slice(0, 200) }));
  }
  if (typeof isAvailable === 'boolean') doctor.isAvailable = isAvailable;
  await doctor.save();
  await syncAvailableDays(doctor._id);
  return doctor;
};

const getSchedule = (doctorId) => DoctorSchedule.find({ doctor: doctorId }).sort({ dayOfWeek: 1 });

module.exports = { getSlots, assertSlotBookable, saveAvailability, syncAvailableDays, getSchedule, buildSlots, loadDoctor };
