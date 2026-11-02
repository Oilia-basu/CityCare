// Nodemailer wrapper. When EMAIL_USER/EMAIL_PASS are missing (local dev) emails are logged to the console instead.
const nodemailer = require('nodemailer');
const { getSettings } = require('./settingsService');
const { to12h } = require('../utils/dateUtils');

let transporter;
const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_USER === 'your_email') return null;
  if (!transporter) transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  return transporter;
};

const wrap = (hospital, title, body) => `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #dbe7ec;border-radius:10px;overflow:hidden">
  <div style="background:#0e6ba8;color:#fff;padding:16px 22px;font-size:18px;font-weight:bold">${hospital}</div>
  <div style="padding:22px;color:#12313f"><h2 style="margin-top:0;font-size:18px">${title}</h2>${body}</div>
  <div style="background:#f3f8fa;padding:12px 22px;font-size:12px;color:#5b7482">This is an automated message. Please do not reply.</div>
</div>`;

const sendEmail = async ({ to, subject, title, html, force = false }) => {
  try {
    const settings = await getSettings();
    if (!force && !settings.emailNotificationsEnabled) return false;
    const body = wrap(settings.hospitalName, title || subject, html);
    const t = getTransporter();
    if (!t) {
      console.log(`[email:dev] to=${to} subject="${subject}"\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')}`);
      return false;
    }
    await t.sendMail({ from: `"${settings.hospitalName}" <${process.env.EMAIL_USER}>`, to, subject, html: body });
    return true;
  } catch (e) {
    console.error('Email failed:', e.message);
    return false;
  }
};

const details = (a) => `
<table style="border-collapse:collapse;font-size:14px">
  <tr><td style="padding:4px 14px 4px 0;color:#5b7482">Appointment ID</td><td><b>${a.appointmentCode}</b></td></tr>
  <tr><td style="padding:4px 14px 4px 0;color:#5b7482">Doctor</td><td>${a.doctor?.user?.name || ''}</td></tr>
  <tr><td style="padding:4px 14px 4px 0;color:#5b7482">Date</td><td>${a.appointmentDate}</td></tr>
  <tr><td style="padding:4px 14px 4px 0;color:#5b7482">Time</td><td>${to12h(a.startTime)} – ${to12h(a.endTime)}</td></tr>
  <tr><td style="padding:4px 14px 4px 0;color:#5b7482">Status</td><td>${a.appointmentStatus}</td></tr>
  <tr><td style="padding:4px 14px 4px 0;color:#5b7482">Payment</td><td>${a.paymentStatus} (₹${a.consultationFee})</td></tr>
</table>`;

const templates = {
  booked: (a) => ({ subject: `Appointment ${a.appointmentStatus === 'Confirmed' ? 'confirmed' : 'requested'} – ${a.appointmentCode}`, title: 'Your appointment', html: `<p>Hello ${a.patient?.user?.name || ''},</p>${details(a)}` }),
  confirmed: (a) => ({ subject: `Appointment confirmed – ${a.appointmentCode}`, title: 'Appointment confirmed', html: `<p>Your appointment is confirmed.</p>${details(a)}` }),
  cancelled: (a) => ({ subject: `Appointment cancelled – ${a.appointmentCode}`, title: 'Appointment cancelled', html: `<p>Your appointment was cancelled${a.cancellationReason ? `: ${a.cancellationReason}` : ''}.</p>${details(a)}` }),
  rejected: (a) => ({ subject: `Appointment declined – ${a.appointmentCode}`, title: 'Appointment declined', html: `<p>The doctor could not accept this appointment${a.cancellationReason ? `: ${a.cancellationReason}` : ''}. Any payment will be refunded.</p>${details(a)}` }),
  rescheduled: (a) => ({ subject: `Appointment rescheduled – ${a.appointmentCode}`, title: 'Appointment rescheduled', html: `<p>Your appointment has a new time.</p>${details(a)}` }),
  payment: (a) => ({ subject: `Payment received – ${a.appointmentCode}`, title: 'Payment received', html: `<p>We received your payment of ₹${a.consultationFee}.</p>${details(a)}` }),
  reminder: (a) => ({ subject: `Reminder: appointment on ${a.appointmentDate}`, title: 'Appointment reminder', html: `<p>This is a reminder of your upcoming appointment.</p>${details(a)}` }),
  completed: (a) => ({ subject: `Consultation completed – ${a.appointmentCode}`, title: 'Consultation completed', html: `<p>Thank you for visiting. You can now rate your doctor from your dashboard.</p>${details(a)}` }),
};

// `appointment` must have patient.user and doctor.user populated.
const sendAppointmentEmail = (kind, appointment) => {
  const to = appointment.patient?.user?.email;
  if (!to || !templates[kind]) return Promise.resolve(false);
  return sendEmail({ to, ...templates[kind](appointment) });
};

const sendPasswordResetEmail = (user, link) =>
  sendEmail({
    to: user.email,
    subject: 'Reset your password',
    title: 'Reset your password',
    force: true,
    html: `<p>Hello ${user.name},</p><p>Use the button below to choose a new password. The link expires in 15 minutes.</p>
    <p><a href="${link}" style="background:#0e6ba8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reset password</a></p>
    <p style="font-size:12px;color:#5b7482">If you did not request this, you can ignore this email.<br>${link}</p>`,
  });

const sendWelcomeCredentials = (user, tempPassword, link) =>
  sendEmail({
    to: user.email,
    subject: 'Your hospital account',
    title: 'Your account is ready',
    force: true,
    html: `<p>Hello ${user.name},</p><p>An account was created for you. Your temporary password is <b>${tempPassword}</b>.</p><p>Please sign in and change it from your profile settings. If you prefer, you can set your own password here: <a href="${link}">set password</a> (valid for 15 minutes).</p>`,
  });

module.exports = { sendEmail, sendAppointmentEmail, sendPasswordResetEmail, sendWelcomeCredentials };
