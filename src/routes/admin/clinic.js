const { crudRouter, isId } = require('../../utils/crud');
const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const { nextSeq } = require('../../models/Counter');
const httpError = require('../../utils/httpError');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMin = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return h * 60 + m;
};
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const doctors = crudRouter(Doctor, {
  search: ['name', 'specialization', 'phone'],
  filters: ['isActive', 'specialization'],
  sort: 'name',
  canDelete: async (id) =>
    (await Appointment.exists({ doctor: id })) && 'This doctor has appointments. Deactivate instead of deleting.',
});

async function assertSlotFree(data, excludeId) {
  if (!data.doctor || !data.date || !data.time) return;
  const clash = await Appointment.exists({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    doctor: data.doctor,
    date: data.date,
    time: data.time,
    status: { $nin: ['cancelled', 'no-show'] },
  });
  if (clash) throw httpError(409, `This doctor already has an appointment at ${data.time} on ${data.date}`);
}

const appointments = crudRouter(Appointment, {
  search: ['patientName', 'patientPhone', 'appointmentNo'],
  filters: ['doctor', 'date', 'status', 'paymentStatus'],
  populate: { path: 'doctor', select: 'name specialization fee' },
  sort: '-date time',
  readOnly: ['appointmentNo'],
  buildQuery: (query, req) => {
    if (req.query.from || req.query.to) {
      query.date = {};
      if (req.query.from) query.date.$gte = req.query.from;
      if (req.query.to) query.date.$lte = req.query.to;
    }
  },
  beforeCreate: async (data) => {
    data.appointmentNo = `AP${String(await nextSeq('appointment')).padStart(5, '0')}`;
    if (data.fee == null && isId(data.doctor)) data.fee = (await Doctor.findById(data.doctor).select('fee'))?.fee || 0;
  },
  beforeSave: async (data, req, id) => {
    if (id && (data.doctor || data.date || data.time)) {
      const current = await Appointment.findById(id).lean();
      if (current) data = { ...current, ...data };
    }
    if (!['cancelled', 'no-show'].includes(data.status)) await assertSlotFree(data, id);
  },
});

// GET ?doctor=&date=YYYY-MM-DD → all slots for that day with availability
async function slots(req, res, next) {
  try {
    const { doctor: doctorId, date } = req.query;
    if (!isId(doctorId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw httpError(400, 'doctor and date are required');
    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) throw httpError(404, 'Doctor not found');

    const day = DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
    const worksToday = !doctor.days?.length || doctor.days.includes(day);
    const booked = new Set(
      (await Appointment.find({ doctor: doctorId, date, status: { $nin: ['cancelled', 'no-show'] } }).select('time').lean()).map((a) => a.time)
    );
    const list = [];
    if (worksToday) {
      for (let m = toMin(doctor.startTime); m + doctor.slotMinutes <= toMin(doctor.endTime); m += doctor.slotMinutes) {
        list.push({ time: toTime(m), booked: booked.has(toTime(m)) });
      }
    }
    res.json({ day, worksToday, slots: list });
  } catch (err) {
    next(err);
  }
}

module.exports = { doctors, appointments, slots };
