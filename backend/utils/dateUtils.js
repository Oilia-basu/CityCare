// Date helpers. Storage = UTC (Date objects). Hospital-local calendar dates/times are "YYYY-MM-DD" / "HH:mm" strings.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const offsetMinutes = () => {
  const n = parseInt(process.env.HOSPITAL_UTC_OFFSET_MINUTES ?? '330', 10);
  return Number.isNaN(n) ? 330 : n;
};

const isValidDate = (s) => {
  if (!DATE_RE.test(s || '')) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const isValidTime = (s) => TIME_RE.test(s || '');

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// Hospital-local date+time -> UTC Date
const toUtc = (date, time) => {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - offsetMinutes() * 60000);
};

// Current hospital-local date and time strings
const localNow = (now = new Date()) => {
  const local = new Date(now.getTime() + offsetMinutes() * 60000);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};

const dayOfWeek = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const addDays = (date, n) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const to12h = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

module.exports = { isValidDate, isValidTime, toMinutes, toTime, toUtc, localNow, dayOfWeek, addDays, to12h, DAY_NAMES, offsetMinutes };
