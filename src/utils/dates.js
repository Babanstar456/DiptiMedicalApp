// The shop runs on Indian Standard Time; servers (e.g. Vercel) run on UTC.
const TZ = 'Asia/Kolkata';
const OFFSET = '+05:30';

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
const startOfDayIST = (ymd) => new Date(`${ymd}T00:00:00${OFFSET}`);
const endOfDayIST = (ymd) => new Date(`${ymd}T23:59:59.999${OFFSET}`);
const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

module.exports = { TZ, todayIST, startOfDayIST, endOfDayIST, daysInMonth, addDays };
