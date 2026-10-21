// Doctor slot availability, shared by the admin panel and online booking.
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const shop = require('../config/shop');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMin = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return h * 60 + m;
};
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Appointments that occupy a slot: everything except cancelled / no-show, and unpaid online bookings
// only while their payment window is still open.
function blockingFilter() {
  const cutoff = new Date(Date.now() - shop.paymentHoldMinutes * 60000);
  return {
    $or: [{ status: { $nin: ['cancelled', 'no-show', 'awaiting-payment'] } }, { status: 'awaiting-payment', createdAt: { $gt: cutoff } }],
  };
}

async function slotsFor(doctorOrId, date) {
  const doctor = doctorOrId?._id ? doctorOrId : await Doctor.findById(doctorOrId).lean();
  if (!doctor) return null;
  const day = DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const worksToday = !doctor.days?.length || doctor.days.includes(day);
  const booked = new Set(
    (await Appointment.find({ doctor: doctor._id, date, ...blockingFilter() }).select('time').lean()).map((a) => a.time)
  );
  const slots = [];
  if (worksToday) {
    for (let m = toMin(doctor.startTime); m + doctor.slotMinutes <= toMin(doctor.endTime); m += doctor.slotMinutes) {
      slots.push({ time: toTime(m), booked: booked.has(toTime(m)) });
    }
  }
  return { doctor, day, worksToday, slots };
}

async function isSlotTaken({ doctor, date, time }, excludeId) {
  return !!(await Appointment.exists({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    doctor,
    date,
    time,
    ...blockingFilter(),
  }));
}

module.exports = { slotsFor, isSlotTaken, toMin };
