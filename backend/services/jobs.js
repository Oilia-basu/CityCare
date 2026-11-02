// Background jobs (simple intervals, no extra infra needed on Render).
const Appointment = require('../models/Appointment');
const { POPULATE } = require('./appointmentPopulate');
const { releaseExpiredReservations } = require('./appointmentService');
const { notify } = require('./notificationService');
const { sendAppointmentEmail } = require('./emailService');
const { getSettings } = require('./settingsService');

const sendReminders = async () => {
  const settings = await getSettings();
  const now = new Date();
  const until = new Date(now.getTime() + settings.reminderHoursBefore * 3600000);
  const list = await Appointment.find({ appointmentStatus: 'Confirmed', reminderSent: false, startAt: { $gt: now, $lte: until } }).populate(POPULATE).limit(200);
  for (const a of list) {
    const claimed = await Appointment.updateOne({ _id: a._id, reminderSent: false }, { reminderSent: true });
    if (!claimed.modifiedCount) continue;
    await notify(a.patient.user._id, { title: 'Appointment reminder', message: `${a.doctor.user.name} • ${a.appointmentDate} at ${a.startTime}`, type: 'reminder', appointment: a });
    sendAppointmentEmail('reminder', a);
  }
};

const startJobs = () => {
  const safe = (fn, name) => () => fn().catch((e) => console.error(`[job:${name}]`, e.message));
  setInterval(safe(releaseExpiredReservations, 'expiry'), 60 * 1000);
  setInterval(safe(sendReminders, 'reminders'), 15 * 60 * 1000);
  safe(releaseExpiredReservations, 'expiry')();
};

module.exports = { startJobs };
