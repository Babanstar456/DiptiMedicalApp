const express = require('express');
const { crudRouter, isId } = require('../../utils/crud');
const Staff = require('../../models/Staff');
const Attendance = require('../../models/Attendance');
const { ATTENDANCE_STATUSES } = require('../../models/Attendance');
const Payroll = require('../../models/Payroll');
const { nextSeq } = require('../../models/Counter');
const { httpError } = require('./stock');
const { daysInMonth, todayIST } = require('../../utils/dates');

const round2 = (n) => Math.round(n * 100) / 100;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const isMonth = (v) => /^\d{4}-\d{2}$/.test(v || '');

/* ---------------- Staff ---------------- */
const staff = crudRouter(Staff, {
  search: ['name', 'employeeId', 'phone', 'designation'],
  filters: ['isActive', 'department'],
  sort: 'name',
  readOnly: ['employeeId'],
  beforeCreate: async (data) => {
    data.employeeId = `EMP${String(await nextSeq('staff')).padStart(3, '0')}`;
  },
  canDelete: async (id) =>
    ((await Payroll.exists({ staff: id })) || (await Attendance.exists({ staff: id }))) &&
    'This employee has attendance or payroll records. Deactivate instead of deleting.',
});

/* ---------------- Attendance ---------------- */
const attendance = express.Router();

// GET /?date=YYYY-MM-DD → every active employee with their record for that day
attendance.get('/', async (req, res, next) => {
  try {
    const date = isDate(req.query.date) ? req.query.date : todayIST();
    const [people, records] = await Promise.all([
      Staff.find({ isActive: true }).select('name employeeId designation photo').sort('name').lean(),
      Attendance.find({ date }).lean(),
    ]);
    const byStaff = new Map(records.map((r) => [String(r.staff), r]));
    res.json({ date, items: people.map((s) => ({ staff: s, record: byStaff.get(String(s._id)) || null })) });
  } catch (err) {
    next(err);
  }
});

// PUT / { date, records:[{ staff, status, checkIn, checkOut, note }] } — empty status clears the record
attendance.put('/', async (req, res, next) => {
  try {
    const { date, records } = req.body || {};
    if (!isDate(date)) throw httpError(400, 'A valid date is required');
    if (date > todayIST()) throw httpError(400, 'Attendance cannot be marked for a future date');
    const ops = (Array.isArray(records) ? records : [])
      .filter((r) => isId(r.staff))
      .map((r) =>
        r.status && ATTENDANCE_STATUSES.includes(r.status)
          ? {
              updateOne: {
                filter: { staff: r.staff, date },
                update: { $set: { status: r.status, checkIn: r.checkIn || '', checkOut: r.checkOut || '', note: r.note || '' } },
                upsert: true,
              },
            }
          : { deleteOne: { filter: { staff: r.staff, date } } }
      );
    if (ops.length) await Attendance.bulkWrite(ops);
    res.json({ ok: true, saved: ops.length });
  } catch (err) {
    next(err);
  }
});

async function monthCounts(month, staffIds) {
  const match = { date: { $gte: `${month}-01`, $lte: `${month}-31` } };
  if (staffIds) match.staff = { $in: staffIds };
  const rows = await Attendance.aggregate([{ $match: match }, { $group: { _id: { staff: '$staff', status: '$status' }, n: { $sum: 1 } } }]);
  const out = new Map();
  for (const { _id, n } of rows) {
    const key = String(_id.staff);
    if (!out.has(key)) out.set(key, Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])));
    out.get(key)[_id.status] = n;
  }
  return out;
}

// GET /summary?month=YYYY-MM → per-employee counts for the month
attendance.get('/summary', async (req, res, next) => {
  try {
    const month = isMonth(req.query.month) ? req.query.month : todayIST().slice(0, 7);
    const people = await Staff.find({ isActive: true }).select('name employeeId designation').sort('name').lean();
    const counts = await monthCounts(month);
    const empty = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0]));
    res.json({
      month,
      daysInMonth: daysInMonth(month),
      items: people.map((s) => ({ staff: s, counts: counts.get(String(s._id)) || empty })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /staff/:id?month=YYYY-MM → daily records for one employee
attendance.get('/staff/:id', async (req, res, next) => {
  try {
    const month = isMonth(req.query.month) ? req.query.month : todayIST().slice(0, 7);
    const records = await Attendance.find({ staff: req.params.id, date: { $gte: `${month}-01`, $lte: `${month}-31` } })
      .sort('date')
      .lean();
    res.json({ month, records });
  } catch (err) {
    next(err);
  }
});

/* ---------------- Payroll ----------------
 * Rules (simple small-shop payroll):
 *   gross            = baseSalary + allowances
 *   per-day rate     = gross / days in month
 *   unpaid days      = absent + unpaid-leave + 0.5 × half-day   (unmarked days are treated as paid)
 *   absenceDeduction = per-day rate × unpaid days
 *   netPay           = gross − absenceDeduction − fixedDeductions − otherDeductions + bonus
 */
function computePay(p) {
  p.grossSalary = round2((p.baseSalary || 0) + (p.allowances || 0));
  const unpaidDays = (p.absent || 0) + (p.unpaidLeave || 0) + 0.5 * (p.halfDay || 0);
  p.absenceDeduction = round2((p.grossSalary / p.daysInMonth) * unpaidDays);
  p.netPay = round2(Math.max(0, p.grossSalary - p.absenceDeduction - (p.fixedDeductions || 0) - (p.otherDeductions || 0) + (p.bonus || 0)));
  return p;
}

const payroll = express.Router();

payroll.get('/', async (req, res, next) => {
  try {
    const month = isMonth(req.query.month) ? req.query.month : todayIST().slice(0, 7);
    const items = await Payroll.find({ month }).populate('staff', 'name employeeId designation department bankName accountNo ifsc').lean();
    items.sort((a, b) => (a.staff?.name || '').localeCompare(b.staff?.name || ''));
    const totals = items.reduce(
      (t, p) => ({
        gross: t.gross + p.grossSalary,
        deductions: t.deductions + p.absenceDeduction + p.fixedDeductions + p.otherDeductions,
        bonus: t.bonus + p.bonus,
        net: t.net + p.netPay,
        paid: t.paid + (p.status === 'paid' ? p.netPay : 0),
      }),
      { gross: 0, deductions: 0, bonus: 0, net: 0, paid: 0 }
    );
    Object.keys(totals).forEach((k) => (totals[k] = round2(totals[k])));
    res.json({ month, items, totals });
  } catch (err) {
    next(err);
  }
});

// POST /generate { month } — (re)builds draft payslips from attendance; paid payslips are never touched.
payroll.post('/generate', async (req, res, next) => {
  try {
    const { month } = req.body || {};
    if (!isMonth(month)) throw httpError(400, 'Choose a month');
    if (month > todayIST().slice(0, 7)) throw httpError(400, 'Payroll cannot be generated for a future month');

    const people = await Staff.find({ isActive: true }).lean();
    const counts = await monthCounts(month, people.map((s) => s._id));
    const existing = new Map((await Payroll.find({ month }).lean()).map((p) => [String(p.staff), p]));
    const dim = daysInMonth(month);
    let generated = 0;

    for (const s of people) {
      const prev = existing.get(String(s._id));
      if (prev?.status === 'paid') continue;
      const c = counts.get(String(s._id)) || {};
      const marked = ATTENDANCE_STATUSES.reduce((n, k) => n + (c[k] || 0), 0);
      const p = computePay({
        staff: s._id,
        month,
        daysInMonth: dim,
        present: c.present || 0,
        halfDay: c['half-day'] || 0,
        paidLeave: c['paid-leave'] || 0,
        unpaidLeave: c['unpaid-leave'] || 0,
        absent: c.absent || 0,
        holiday: c.holiday || 0,
        unmarked: Math.max(0, dim - marked),
        baseSalary: s.baseSalary || 0,
        allowances: s.allowances || 0,
        fixedDeductions: s.fixedDeductions || 0,
        bonus: prev?.bonus || 0,
        otherDeductions: prev?.otherDeductions || 0,
        note: prev?.note || '',
        status: 'draft',
      });
      await Payroll.updateOne({ staff: s._id, month }, { $set: p }, { upsert: true });
      generated++;
    }
    res.json({ ok: true, generated });
  } catch (err) {
    next(err);
  }
});

// PUT /:id { bonus, otherDeductions, note } — only for drafts
payroll.put('/:id', async (req, res, next) => {
  try {
    const p = await Payroll.findById(req.params.id);
    if (!p) throw httpError(404, 'Payslip not found');
    if (p.status === 'paid') throw httpError(409, 'Paid payslips cannot be edited. Mark it unpaid first.');
    const { bonus, otherDeductions, note } = req.body || {};
    if (bonus !== undefined) p.bonus = Math.max(0, Number(bonus) || 0);
    if (otherDeductions !== undefined) p.otherDeductions = Math.max(0, Number(otherDeductions) || 0);
    if (note !== undefined) p.note = note;
    computePay(p);
    await p.save();
    res.json(p);
  } catch (err) {
    next(err);
  }
});

// POST /:id/pay { paymentMethod } and POST /:id/unpay
payroll.post('/:id/pay', async (req, res, next) => {
  try {
    const method = ['cash', 'bank', 'upi'].includes(req.body?.paymentMethod) ? req.body.paymentMethod : 'bank';
    const p = await Payroll.findByIdAndUpdate(req.params.id, { status: 'paid', paidOn: new Date(), paymentMethod: method }, { new: true });
    if (!p) throw httpError(404, 'Payslip not found');
    res.json(p);
  } catch (err) {
    next(err);
  }
});

payroll.post('/:id/unpay', async (req, res, next) => {
  try {
    const p = await Payroll.findByIdAndUpdate(req.params.id, { status: 'draft', paidOn: null, paymentMethod: '' }, { new: true });
    if (!p) throw httpError(404, 'Payslip not found');
    res.json(p);
  } catch (err) {
    next(err);
  }
});

payroll.delete('/:id', async (req, res, next) => {
  try {
    const p = await Payroll.findById(req.params.id);
    if (!p) throw httpError(404, 'Payslip not found');
    if (p.status === 'paid') throw httpError(409, 'Paid payslips cannot be deleted');
    await p.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { staff, attendance, payroll };
