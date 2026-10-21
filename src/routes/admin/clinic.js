const { crudRouter, isId } = require('../../utils/crud');
const Doctor = require('../../models/Doctor');
const Appointment = require('../../models/Appointment');
const { nextSeq } = require('../../models/Counter');
const httpError = require('../../utils/httpError');
const { slotsFor, isSlotTaken } = require('../../services/slots');

const doctors = crudRouter(Doctor, {
  search: ['name', 'specialization', 'phone'],
  filters: ['isActive', 'specialization'],
  sort: 'name',
  canDelete: async (id) =>
    (await Appointment.exists({ doctor: id })) && 'This doctor has appointments. Deactivate instead of deleting.',
});

async function assertSlotFree(data, excludeId) {
  if (!data.doctor || !data.date || !data.time) return;
  if (await isSlotTaken(data, excludeId)) throw httpError(409, `This doctor already has an appointment at ${data.time} on ${data.date}`);
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
    if (!['cancelled', 'no-show', 'awaiting-payment'].includes(data.status)) await assertSlotFree(data, id);
  },
});

// GET ?doctor=&date=YYYY-MM-DD → all slots for that day with availability
async function slots(req, res, next) {
  try {
    const { doctor, date } = req.query;
    if (!isId(doctor) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw httpError(400, 'doctor and date are required');
    const r = await slotsFor(doctor, date);
    if (!r) throw httpError(404, 'Doctor not found');
    res.json({ day: r.day, worksToday: r.worksToday, slots: r.slots });
  } catch (err) {
    next(err);
  }
}

module.exports = { doctors, appointments, slots };
