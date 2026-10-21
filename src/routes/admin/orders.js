const r = require('express').Router();
const Order = require('../../models/Order');
const { ORDER_STATUSES } = require('../../models/Order');
const { priceOrder, nextOrderNo } = require('../../services/orders');
const httpError = require('../../utils/httpError');
const { escapeRegex, isId } = require('../../utils/crud');
const { startOfDayIST, endOfDayIST } = require('../../utils/dates');

r.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const query = {};
    for (const f of ['status', 'channel', 'paymentStatus']) if (req.query[f]) query[f] = req.query[f];
    if (query.status === 'open') query.status = { $in: ['pending', 'confirmed', 'packed', 'out-for-delivery'] };
    if (req.query.q) {
      const re = new RegExp(escapeRegex(req.query.q.trim()), 'i');
      query.$or = [{ orderNo: re }, { 'customer.name': re }, { 'customer.phone': re }];
    }
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = startOfDayIST(req.query.from);
      if (req.query.to) query.createdAt.$lte = endOfDayIST(req.query.to);
    }
    const [items, total, totals] = await Promise.all([
      Order.find(query).select('-history').sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(query),
      Order.aggregate([{ $match: { ...query, status: { $ne: 'cancelled' } } }, { $group: { _id: null, amount: { $sum: '$total' } } }]),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, amount: totals[0]?.amount || 0 });
  } catch (err) {
    next(err);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const order = await Order.findById(req.params.id)
      .populate('history.by', 'displayName email')
      .populate('createdBy', 'displayName email')
      .populate('user', 'displayName email phoneNumber dob gender healthConditions healthNotes')
      .lean();
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// Body: { customer:{name,phone,address}, items:[{product, quantity}], discount, paymentMethod, paymentStatus, channel, status, notes, prescriptionImage }
r.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const { items, subtotal, discount, tax, total } = await priceOrder(body.items, body.discount);
    const orderNo = await nextOrderNo();
    const status = ORDER_STATUSES.includes(body.status) && !['cancelled', 'awaiting-payment'].includes(body.status) ? body.status : 'confirmed';

    const order = await Order.create({
      orderNo,
      channel: body.channel,
      customer: body.customer,
      items,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus,
      status,
      notes: body.notes,
      prescriptionImage: body.prescriptionImage,
      history: [{ status, by: req.user._id }],
      createdBy: req.user._id,
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

r.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!ORDER_STATUSES.includes(status)) throw httpError(400, 'Invalid status');
    const order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');
    if (order.status === 'cancelled') throw httpError(409, 'Cancelled orders cannot be changed');
    if (order.status === 'awaiting-payment' && status !== 'cancelled') throw httpError(409, 'This order has not been paid yet');
    if (order.status === status) return res.json(order);

    if (status === 'cancelled' && order.paymentStatus === 'paid') order.paymentStatus = 'refunded';
    order.status = status;
    order.history.push({ status, by: req.user._id });
    await order.save();
    res.json(order);
  } catch (err) {
    next(err);
  }
});

r.patch('/:id/payment', async (req, res, next) => {
  try {
    const set = {};
    if (['unpaid', 'paid', 'refunded'].includes(req.body?.paymentStatus)) set.paymentStatus = req.body.paymentStatus;
    if (['cash', 'upi', 'card', 'cod', 'online'].includes(req.body?.paymentMethod)) set.paymentMethod = req.body.paymentMethod;
    const order = await Order.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
    if (!order) throw httpError(404, 'Order not found');
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = r;
