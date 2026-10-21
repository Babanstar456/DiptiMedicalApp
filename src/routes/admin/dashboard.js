const r = require('express').Router();
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const Appointment = require('../../models/Appointment');
const Staff = require('../../models/Staff');
const Attendance = require('../../models/Attendance');
const { todayIST, startOfDayIST, endOfDayIST, addDays, TZ } = require('../../utils/dates');

const OPEN = ['pending', 'confirmed', 'packed', 'out-for-delivery'];

r.get('/', async (req, res, next) => {
  try {
    const today = todayIST();
    const monthStart = startOfDayIST(`${today.slice(0, 7)}-01`);
    const weekStart = startOfDayIST(addDays(today, -6));
    const notCancelled = { status: { $nin: ['cancelled', 'awaiting-payment'] } };
    const sum = (match) => Order.aggregate([{ $match: match }, { $group: { _id: null, amount: { $sum: '$total' }, count: { $sum: 1 } } }]);

    const [todaySales, monthSales, openOrders, outOfStock, noPrice, products, appointmentsToday, upcoming, staffCount, presentToday, recentOrders, last7] =
      await Promise.all([
        sum({ ...notCancelled, createdAt: { $gte: startOfDayIST(today), $lte: endOfDayIST(today) } }),
        sum({ ...notCancelled, createdAt: { $gte: monthStart } }),
        Order.countDocuments({ status: { $in: OPEN } }),
        Product.countDocuments({ isActive: true, inStock: false }),
        Product.countDocuments({ isActive: true, price: { $lte: 0 } }),
        Product.countDocuments({ isActive: true }),
        Appointment.countDocuments({ date: today, status: { $nin: ['cancelled'] } }),
        Appointment.find({ date: today, status: { $in: ['pending', 'confirmed'] } })
          .populate('doctor', 'name')
          .sort('time')
          .limit(8)
          .lean(),
        Staff.countDocuments({ isActive: true }),
        Attendance.countDocuments({ date: today, status: { $in: ['present', 'half-day'] } }),
        Order.find().select('orderNo customer total status paymentStatus createdAt').sort('-createdAt').limit(6).lean(),
        Order.aggregate([
          { $match: { ...notCancelled, createdAt: { $gte: weekStart } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, amount: { $sum: '$total' } } },
        ]),
      ]);

    const byDay = new Map(last7.map((d) => [d._id, d.amount]));
    res.json({
      today,
      sales: {
        today: todaySales[0] || { amount: 0, count: 0 },
        month: monthSales[0] || { amount: 0, count: 0 },
        last7Days: Array.from({ length: 7 }, (_, i) => {
          const d = addDays(today, i - 6);
          return { date: d, amount: byDay.get(d) || 0 };
        }),
      },
      openOrders,
      inventory: { products, outOfStock, noPrice },
      appointments: { today: appointmentsToday, upcoming },
      staff: { total: staffCount, presentToday },
      recentOrders,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = r;
