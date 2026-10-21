const r = require('express').Router();
const Order = require('../../models/Order');
const { ORDER_STATUSES } = require('../../models/Order');
const Product = require('../../models/Product');
const { nextSeq } = require('../../models/Counter');
const { changeStock, httpError } = require('./stock');
const { escapeRegex, isId } = require('../../utils/crud');
const { startOfDayIST, endOfDayIST, todayIST } = require('../../utils/dates');

const round2 = (n) => Math.round(n * 100) / 100;

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
      .lean();
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// Body: { customer:{name,phone,address}, items:[{product, quantity}], discount, paymentMethod, paymentStatus, channel, status, notes, prescriptionImage }
r.post('/', async (req, res, next) => {
  const deducted = [];
  try {
    const body = req.body || {};
    const wanted = (Array.isArray(body.items) ? body.items : []).filter((i) => isId(i.product) && Number(i.quantity) > 0);
    if (!wanted.length) throw httpError(400, 'Add at least one product');

    const products = await Product.find({ _id: { $in: wanted.map((i) => i.product) } }).lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const items = wanted.map((i) => {
      const p = byId.get(String(i.product));
      if (!p || !p.isActive) throw httpError(400, 'One of the products is unavailable');
      const quantity = Math.floor(Number(i.quantity));
      return { product: p._id, name: p.name, price: p.price, quantity, gstRate: p.gstRate, total: round2(p.price * quantity) };
    });

    const subtotal = round2(items.reduce((s, i) => s + i.total, 0));
    const discount = Math.min(subtotal, Math.max(0, Number(body.discount) || 0));
    const total = round2(subtotal - discount);
    // Prices are GST-inclusive: tax = price − price / (1 + rate)
    const tax = round2(items.reduce((s, i) => s + (i.total - i.total / (1 + (i.gstRate || 0) / 100)), 0) * (subtotal ? total / subtotal : 0));

    const seq = await nextSeq(`order-${todayIST().slice(0, 7)}`);
    const orderNo = `DM${todayIST().slice(2, 7).replace('-', '')}-${String(seq).padStart(4, '0')}`;
    const status = ORDER_STATUSES.includes(body.status) && body.status !== 'cancelled' ? body.status : 'confirmed';

    for (const i of items) {
      await changeStock(i.product, -i.quantity, { type: 'sale', reference: orderNo, by: req.user._id });
      deducted.push(i);
    }

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
    // Put back any stock already taken for this failed order
    for (const i of deducted) {
      await changeStock(i.product, i.quantity, { type: 'return', note: 'Order creation failed', by: req.user._id }).catch(() => {});
    }
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
    if (order.status === status) return res.json(order);

    if (status === 'cancelled') {
      for (const i of order.items) {
        await changeStock(i.product, i.quantity, { type: 'return', reference: order.orderNo, note: 'Order cancelled', by: req.user._id });
      }
      if (order.paymentStatus === 'paid') order.paymentStatus = 'refunded';
    }
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
