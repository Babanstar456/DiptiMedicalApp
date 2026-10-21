// Customer-facing shop API. Public: catalogue, doctors, slots. Signed-in: profile, checkout, payments, bookings.
const express = require('express');
const shop = require('../config/shop');
const CONDITIONS = require('../config/conditions');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Doctor = require('../models/Doctor');
const Order = require('../models/Order');
const Appointment = require('../models/Appointment');
const Image = require('../models/Image');
const PrescriptionRequest = require('../models/PrescriptionRequest');
const { nextSeq } = require('../models/Counter');
const requireCustomer = require('../middleware/requireCustomer');
const { priceOrder, nextOrderNo } = require('../services/orders');
const { slotsFor, isSlotTaken, toMin } = require('../services/slots');
const { saveImage, sendImage } = require('../services/images');
const razorpay = require('../utils/razorpay');
const httpError = require('../utils/httpError');
const { escapeRegex, isId } = require('../utils/crud');
const { todayIST, addDays } = require('../utils/dates');

const r = express.Router();

// Only what customers should see (no supplier, rack or internal notes)
const PUBLIC_PRODUCT = 'name category type manufacturer composition strength packSize description images mrp price inStock prescriptionRequired featured';
const PUBLIC_DOCTOR = 'name specialization qualification photo fee days startTime endTime slotMinutes bio';
const visible = { isActive: true };
// Sellable items first, then in-stock "call to order" items, then out of stock
const SELLABLE_FIRST = [
  { $addFields: { _rank: { $cond: [{ $and: ['$inStock', { $gt: ['$price', 0] }] }, 0, { $cond: ['$inStock', 1, 2] }] } } },
  { $sort: { _rank: 1, name: 1 } },
];

const conditionFilter = (slug) => {
  const c = CONDITIONS.find((x) => x.slug === slug);
  return c ? { composition: new RegExp(c.salts.map(escapeRegex).join('|'), 'i') } : null;
};

async function populateRefs(products) {
  return Product.populate(products, [
    { path: 'category', select: 'name' },
    { path: 'type', select: 'name' },
  ]);
}
async function listProducts(match, { sort = 'relevance', skip = 0, limit = 12 } = {}) {
  const sortStage = { price_asc: { price: 1, name: 1 }, price_desc: { price: -1, name: 1 }, name: { name: 1 } }[sort];
  const pipeline = [{ $match: { ...visible, ...match } }];
  if (sortStage) {
    if (sort.startsWith('price')) pipeline.push({ $match: { price: { $gt: 0 } } });
    pipeline.push({ $sort: sortStage });
  } else pipeline.push(...SELLABLE_FIRST);
  pipeline.push({ $skip: skip }, { $limit: limit }, { $project: Object.fromEntries(PUBLIC_PRODUCT.split(' ').map((f) => [f, 1])) });
  return populateRefs(await Product.aggregate(pipeline));
}

/* ---------------- Public ---------------- */
r.get('/config', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    name: shop.name,
    phone: shop.phone,
    email: shop.email,
    minOrderValue: shop.minOrderValue,
    consultTokenAmount: shop.consultTokenAmount,
    paymentsEnabled: razorpay.enabled(),
    razorpayKeyId: razorpay.keyId() || null,
  });
});

r.get('/home', async (req, res, next) => {
  try {
    const categories = await Category.aggregate([
      { $match: { isActive: true } },
      { $lookup: { from: 'products', let: { c: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$category', '$$c'] }, isActive: true } }, { $count: 'n' }], as: 'count' } },
      { $addFields: { productCount: { $ifNull: [{ $first: '$count.n' }, 0] } } },
      { $match: { productCount: { $gt: 0 } } },
      { $sort: { sortOrder: 1, productCount: -1 } },
      { $project: { name: 1, image: 1, productCount: 1 } },
    ]);

    const rails = [];
    const featured = await listProducts({ featured: true }, { limit: 16 });
    if (featured.length) rails.push({ key: 'bestsellers', title: 'Bestsellers', link: '#/search?featured=1', items: featured });
    for (const c of categories.slice(0, 5)) {
      const items = await listProducts({ category: c._id }, { limit: 12 });
      if (items.length) rails.push({ key: String(c._id), title: c.name, link: `#/category/${c._id}`, items });
    }

    const conditions = await Promise.all(
      CONDITIONS.map(async (c) => ({ slug: c.slug, name: c.name, icon: c.icon, count: await Product.countDocuments({ ...visible, ...conditionFilter(c.slug) }) }))
    );
    const doctors = await Doctor.find({ isActive: true }).select(PUBLIC_DOCTOR).sort('name').limit(8).lean();
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ categories, rails, conditions: conditions.filter((c) => c.count > 0), doctors });
  } catch (err) {
    next(err);
  }
});

r.get('/categories', async (req, res, next) => {
  try {
    res.json(await Category.find({ isActive: true }).select('name image').sort('sortOrder name').lean());
  } catch (err) {
    next(err);
  }
});

// GET /products?q=&category=&condition=&inStock=1&featured=1&sort=relevance|price_asc|price_desc|name&page=
r.get('/products', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, parseInt(req.query.limit, 10) || 24);
    const match = {};
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      match.$or = [{ name: re }, { composition: re }, { manufacturer: re }];
    }
    if (isId(req.query.category)) match.category = new (require('mongoose').Types.ObjectId)(req.query.category);
    if (req.query.condition) Object.assign(match, conditionFilter(req.query.condition) || { _id: null });
    if (req.query.inStock === '1') match.inStock = true;
    if (req.query.featured === '1') match.featured = true;
    if (req.query.ids) {
      const ObjectId = require('mongoose').Types.ObjectId;
      match._id = { $in: String(req.query.ids).split(',').filter(isId).slice(0, 50).map((id) => new ObjectId(id)) };
    }

    const [items, total] = await Promise.all([
      listProducts(match, { sort: req.query.sort, skip: (page - 1) * limit, limit }),
      Product.countDocuments({ ...visible, ...match }),
    ]);
    const condition = CONDITIONS.find((c) => c.slug === req.query.condition);
    const category = match.category ? await Category.findById(match.category).select('name').lean() : null;
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, title: condition?.name || category?.name || null });
  } catch (err) {
    next(err);
  }
});

// Quick suggestions for the search box
r.get('/suggest', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q.length < 2) return res.json([]);
    const re = new RegExp(`^${escapeRegex(q)}|\\b${escapeRegex(q)}`, 'i');
    const items = await Product.find({ ...visible, $or: [{ name: re }, { composition: re }] })
      .select('name composition price inStock')
      .sort({ inStock: -1, price: -1, name: 1 })
      .limit(8)
      .lean();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

r.get('/products/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) throw httpError(404, 'Product not found');
    const p = await Product.findOne({ _id: req.params.id, ...visible }).select(PUBLIC_PRODUCT).populate('category', 'name').populate('type', 'name').lean();
    if (!p) throw httpError(404, 'Product not found');
    const similarMatch = { _id: { $ne: p._id } };
    if (p.composition) similarMatch.composition = p.composition;
    else if (p.category) similarMatch.category = p.category._id;
    const similar = await listProducts(similarMatch, { limit: 12 });
    res.json({ product: p, similar });
  } catch (err) {
    next(err);
  }
});

r.get('/doctors', async (req, res, next) => {
  try {
    res.json(await Doctor.find({ isActive: true }).select(PUBLIC_DOCTOR).sort('name').lean());
  } catch (err) {
    next(err);
  }
});

const nowMinutesIST = () => {
  const [h, m] = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }).split(':').map(Number);
  return h * 60 + m;
};
const bookableDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && date >= todayIST() && date <= addDays(todayIST(), shop.bookingDaysAhead);

r.get('/doctors/:id/slots', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!isId(req.params.id)) throw httpError(404, 'Doctor not found');
    if (!bookableDate(date)) throw httpError(400, `Choose a date within the next ${shop.bookingDaysAhead} days`);
    const doctor = await Doctor.findOne({ _id: req.params.id, isActive: true }).lean();
    if (!doctor) throw httpError(404, 'Doctor not found');
    const result = await slotsFor(doctor, date);
    const past = date === todayIST() ? nowMinutesIST() + 15 : -1;
    res.json({ day: result.day, worksToday: result.worksToday, slots: result.slots.map((s) => ({ ...s, booked: s.booked || toMin(s.time) <= past })) });
  } catch (err) {
    next(err);
  }
});

/* ---------------- Payments ---------------- */
const paymentPayload = (rzpOrder, description, user, extra = {}) => ({
  keyId: razorpay.keyId(),
  razorpayOrderId: rzpOrder.id,
  amount: rzpOrder.amount,
  currency: rzpOrder.currency || 'INR',
  name: shop.name,
  description,
  prefill: { name: user.displayName || '', email: user.email || '', contact: extra.contact || user.phoneNumber || '' },
});

// Marks the matching order / appointment paid. Used by checkout verification and the webhook.
async function markPaid(razorpayOrderId, razorpayPaymentId) {
  const order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
  if (order) {
    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.payment.razorpayPaymentId = razorpayPaymentId;
      order.payment.paidAt = new Date();
      if (order.status === 'awaiting-payment') {
        order.status = 'confirmed';
        order.history.push({ status: 'confirmed' });
      }
      await order.save();
    }
    return { kind: 'order', id: order._id };
  }
  const appt = await Appointment.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
  if (appt) {
    if (appt.paymentStatus === 'unpaid') {
      appt.paymentStatus = 'token-paid';
      appt.payment.razorpayPaymentId = razorpayPaymentId;
      appt.payment.paidAt = new Date();
      if (appt.status === 'awaiting-payment') appt.status = 'confirmed';
      await appt.save();
    }
    return { kind: 'appointment', id: appt._id };
  }
  return null;
}

// Razorpay webhook (payment.captured / order.paid). Raw body is attached by server.js.
r.post('/payments/webhook', async (req, res, next) => {
  try {
    if (!razorpay.verifyWebhook(req.rawBody || '', req.get('x-razorpay-signature'))) return res.status(400).json({ error: 'Bad signature' });
    const payment = req.body?.payload?.payment?.entity;
    if (payment?.order_id && ['captured', 'authorized'].includes(payment.status)) await markPaid(payment.order_id, payment.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------------- Signed-in customers ---------------- */
const me = express.Router();
me.use(requireCustomer);

me.get('/me', (req, res) => res.json({ user: req.user.toPublic() }));

const PINCODE = /^\d{6}$/;
const PHONE = /^[6-9]\d{9}$/;
function cleanAddress(a = {}) {
  const addr = {};
  for (const k of ['name', 'phone', 'line1', 'line2', 'landmark', 'city', 'pincode']) addr[k] = String(a[k] || '').trim().slice(0, 200);
  addr.phone = addr.phone.replace(/\D/g, '').slice(-10);
  if (!addr.name) throw httpError(400, 'Enter the name for delivery');
  if (!PHONE.test(addr.phone)) throw httpError(400, 'Enter a valid 10-digit mobile number');
  if (!addr.line1) throw httpError(400, 'Enter the delivery address');
  if (!addr.city) throw httpError(400, 'Enter the city');
  if (!PINCODE.test(addr.pincode)) throw httpError(400, 'Enter a valid 6-digit PIN code');
  return addr;
}
const GENDERS = ['', 'Male', 'Female', 'Other'];

// Body: any of { displayName, phoneNumber, dob, gender, healthConditions[], healthNotes, addresses[] }
me.put('/me', async (req, res, next) => {
  try {
    const b = req.body || {};
    const u = req.user;
    if (b.displayName !== undefined) {
      u.displayName = String(b.displayName).trim().slice(0, 100);
      if (!u.displayName) throw httpError(400, 'Enter your name');
    }
    if (b.phoneNumber !== undefined) {
      const phone = String(b.phoneNumber).replace(/\D/g, '').slice(-10);
      if (!PHONE.test(phone)) throw httpError(400, 'Enter a valid 10-digit mobile number');
      u.phoneNumber = phone;
    }
    if (b.dob !== undefined) {
      const dob = String(b.dob || '');
      if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob > todayIST() || dob < '1900-01-01')) throw httpError(400, 'Enter a valid date of birth');
      u.dob = dob || undefined;
    }
    if (b.gender !== undefined) {
      if (!GENDERS.includes(b.gender)) throw httpError(400, 'Invalid gender');
      u.gender = b.gender;
    }
    if (Array.isArray(b.healthConditions)) {
      u.healthConditions = [...new Set(b.healthConditions.map((c) => String(c).trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
    }
    if (b.healthNotes !== undefined) u.healthNotes = String(b.healthNotes).trim().slice(0, 500);
    if (Array.isArray(b.addresses)) {
      // Same street + PIN + phone counts as one address
      const seen = new Set();
      u.addresses = b.addresses.slice(0, 10).map(cleanAddress).filter((a) => {
        const key = `${a.line1.toLowerCase()}|${a.pincode}|${a.phone}`;
        return !seen.has(key) && seen.add(key);
      });
    }
    await u.save();
    res.json({ user: req.user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// Prescription photos: private to the customer and pharmacy staff
me.post('/uploads', express.json({ limit: '3mb' }), async (req, res, next) => {
  try {
    const img = await saveImage(req.body?.data, req.user._id, { isPrivate: true });
    res.status(201).json({ id: img._id });
  } catch (err) {
    next(err);
  }
});
me.get('/uploads/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).end();
    const img = await Image.findOne({ _id: req.params.id, uploadedBy: req.user._id }).lean();
    if (!img) return res.status(404).end();
    sendImage(res, img, 'private, no-store');
  } catch (err) {
    next(err);
  }
});

const formatAddress = (a) => [a.line1, a.line2, a.landmark && `Near ${a.landmark}`, `${a.city} - ${a.pincode}`].filter(Boolean).join(', ');

// Body: { items:[{product, quantity}], address:{...}, prescriptionImage, notes, saveAddress }
const requirePayments = () => {
  if (!razorpay.enabled()) throw httpError(503, `Online payment is not set up yet. Please call ${shop.phone} to order.`);
};

me.post('/orders', async (req, res, next) => {
  try {
    requirePayments();
    const body = req.body || {};
    const priced = await priceOrder(body.items);
    if (priced.total < shop.minOrderValue) {
      throw httpError(400, `Minimum order value is ₹${shop.minOrderValue}. Add ₹${Math.ceil(shop.minOrderValue - priced.total)} more to continue.`);
    }
    if (priced.needsPrescription) {
      const ok = isId(body.prescriptionImage) && (await Image.exists({ _id: body.prescriptionImage, uploadedBy: req.user._id }));
      if (!ok) throw httpError(400, 'Your cart has prescription medicines. Please upload a photo of your prescription.');
    }
    const address = cleanAddress(body.address);

    const order = await Order.create({
      orderNo: await nextOrderNo(),
      channel: 'online',
      user: req.user._id,
      customer: { name: address.name, phone: address.phone, address: formatAddress(address), pincode: address.pincode },
      items: priced.items,
      subtotal: priced.subtotal,
      discount: 0,
      tax: priced.tax,
      total: priced.total,
      paymentMethod: 'online',
      paymentStatus: 'unpaid',
      status: 'awaiting-payment',
      prescriptionImage: priced.needsPrescription ? String(body.prescriptionImage) : undefined,
      notes: String(body.notes || '').slice(0, 500),
      history: [{ status: 'awaiting-payment', by: req.user._id }],
    });

    // Delivery name, phone and address are always kept on the account
    if (!req.user.addresses.some((a) => a.line1 === address.line1 && a.pincode === address.pincode && a.phone === address.phone)) {
      req.user.addresses.unshift(address);
      req.user.addresses = req.user.addresses.slice(0, 10);
    }
    if (!req.user.phoneNumber) req.user.phoneNumber = address.phone;
    if (!req.user.displayName) req.user.displayName = address.name;
    await req.user.save();

    const rzp = await razorpay.createOrder(order.total, order.orderNo, { kind: 'order', orderNo: order.orderNo });
    order.payment = { razorpayOrderId: rzp.id };
    await order.save();
    res.status(201).json({ order: { _id: order._id, orderNo: order.orderNo, total: order.total }, payment: paymentPayload(rzp, `Order ${order.orderNo}`, req.user, { contact: address.phone }) });
  } catch (err) {
    next(err);
  }
});

me.get('/orders', async (req, res, next) => {
  try {
    res.json(await Order.find({ user: req.user._id }).select('-history.by -createdBy').sort('-createdAt').limit(50).lean());
  } catch (err) {
    next(err);
  }
});

me.get('/orders/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) throw httpError(404, 'Order not found');
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).select('-history.by -createdBy').lean();
    if (!order) throw httpError(404, 'Order not found');
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// Retry payment for an unpaid order
me.post('/orders/:id/pay', async (req, res, next) => {
  try {
    const order = isId(req.params.id) && (await Order.findOne({ _id: req.params.id, user: req.user._id }));
    if (!order) throw httpError(404, 'Order not found');
    if (order.status !== 'awaiting-payment') throw httpError(409, 'This order does not need payment');
    await priceOrder(order.items.map((i) => ({ product: i.product, quantity: i.quantity }))); // still available?
    const rzp = await razorpay.createOrder(order.total, order.orderNo, { kind: 'order', orderNo: order.orderNo });
    order.payment = { razorpayOrderId: rzp.id };
    await order.save();
    res.json({ order: { _id: order._id, orderNo: order.orderNo, total: order.total }, payment: paymentPayload(rzp, `Order ${order.orderNo}`, req.user, { contact: order.customer.phone }) });
  } catch (err) {
    next(err);
  }
});

me.post('/orders/:id/cancel', async (req, res, next) => {
  try {
    const order = isId(req.params.id) && (await Order.findOne({ _id: req.params.id, user: req.user._id }));
    if (!order) throw httpError(404, 'Order not found');
    if (order.status !== 'awaiting-payment') throw httpError(409, `Paid orders can't be cancelled online. Please call ${shop.phone}.`);
    order.status = 'cancelled';
    order.history.push({ status: 'cancelled', by: req.user._id });
    await order.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Body: { doctor, date, time, patientName, patientPhone, patientAge, patientGender, reason }
me.post('/appointments', async (req, res, next) => {
  try {
    requirePayments();
    const b = req.body || {};
    if (!isId(b.doctor)) throw httpError(400, 'Choose a doctor');
    const doctor = await Doctor.findOne({ _id: b.doctor, isActive: true }).lean();
    if (!doctor) throw httpError(404, 'Doctor not found');
    if (!bookableDate(b.date)) throw httpError(400, `Choose a date within the next ${shop.bookingDaysAhead} days`);
    const slot = (await slotsFor(doctor, b.date)).slots.find((s) => s.time === b.time);
    if (!slot) throw httpError(400, 'Choose one of the available time slots');
    if (b.date === todayIST() && toMin(b.time) <= nowMinutesIST() + 15) throw httpError(400, 'That time has passed. Please choose a later slot.');
    if (await isSlotTaken({ doctor: doctor._id, date: b.date, time: b.time })) throw httpError(409, 'Sorry, that slot was just booked. Please pick another.');
    const name = String(b.patientName || '').trim();
    const phone = String(b.patientPhone || '').replace(/\D/g, '').slice(-10);
    if (!name) throw httpError(400, 'Enter the patient name');
    if (!PHONE.test(phone)) throw httpError(400, 'Enter a valid 10-digit mobile number');

    const appt = await Appointment.create({
      appointmentNo: `AP${String(await nextSeq('appointment')).padStart(5, '0')}`,
      doctor: doctor._id,
      user: req.user._id,
      patientName: name.slice(0, 100),
      patientPhone: phone,
      patientAge: Number(b.patientAge) || undefined,
      patientGender: ['Male', 'Female', 'Other'].includes(b.patientGender) ? b.patientGender : '',
      date: b.date,
      time: b.time,
      reason: String(b.reason || '').slice(0, 500),
      status: 'awaiting-payment',
      channel: 'online',
      fee: doctor.fee,
      tokenAmount: shop.consultTokenAmount,
      paymentStatus: 'unpaid',
    });
    const rzp = await razorpay.createOrder(shop.consultTokenAmount, appt.appointmentNo, { kind: 'appointment', appointmentNo: appt.appointmentNo });
    appt.payment = { razorpayOrderId: rzp.id };
    await appt.save();
    res.status(201).json({ appointment: { _id: appt._id, appointmentNo: appt.appointmentNo }, payment: paymentPayload(rzp, `Consultation token · ${doctor.name}`, req.user, { contact: phone }) });
  } catch (err) {
    next(err);
  }
});

me.get('/appointments', async (req, res, next) => {
  try {
    res.json(await Appointment.find({ user: req.user._id }).populate('doctor', 'name specialization photo').sort('-date -time').limit(50).lean());
  } catch (err) {
    next(err);
  }
});

me.post('/appointments/:id/pay', async (req, res, next) => {
  try {
    const appt = isId(req.params.id) && (await Appointment.findOne({ _id: req.params.id, user: req.user._id }).populate('doctor', 'name'));
    if (!appt) throw httpError(404, 'Appointment not found');
    if (appt.status !== 'awaiting-payment') throw httpError(409, 'This booking does not need payment');
    if (await isSlotTaken({ doctor: appt.doctor._id, date: appt.date, time: appt.time }, appt._id)) {
      throw httpError(409, 'Sorry, this slot has been taken. Please book another slot.');
    }
    appt.set('createdAt', new Date()); // restart the hold window
    const rzp = await razorpay.createOrder(appt.tokenAmount, appt.appointmentNo, { kind: 'appointment', appointmentNo: appt.appointmentNo });
    appt.payment = { razorpayOrderId: rzp.id };
    await appt.save({ timestamps: false });
    res.json({ appointment: { _id: appt._id, appointmentNo: appt.appointmentNo }, payment: paymentPayload(rzp, `Consultation token · ${appt.doctor.name}`, req.user, { contact: appt.patientPhone }) });
  } catch (err) {
    next(err);
  }
});

me.post('/appointments/:id/cancel', async (req, res, next) => {
  try {
    const appt = isId(req.params.id) && (await Appointment.findOne({ _id: req.params.id, user: req.user._id }));
    if (!appt) throw httpError(404, 'Appointment not found');
    if (appt.status !== 'awaiting-payment') throw httpError(409, `To cancel a paid booking please call ${shop.phone}.`);
    appt.status = 'cancelled';
    await appt.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Checkout success callback: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
me.post('/payments/verify', async (req, res, next) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (!razorpay.verifyPayment(orderId, paymentId, signature)) throw httpError(400, 'Payment could not be verified. If money was deducted, it will be confirmed shortly.');
    const owned =
      (await Order.exists({ 'payment.razorpayOrderId': orderId, user: req.user._id })) ||
      (await Appointment.exists({ 'payment.razorpayOrderId': orderId, user: req.user._id }));
    if (!owned) throw httpError(404, 'Payment not found');
    res.json(await markPaid(orderId, paymentId));
  } catch (err) {
    next(err);
  }
});

// Body: { image, name, phone, address, notes }
me.post('/prescriptions', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!isId(b.image) || !(await Image.exists({ _id: b.image, uploadedBy: req.user._id }))) throw httpError(400, 'Please add a photo of your prescription');
    const phone = String(b.phone || '').replace(/\D/g, '').slice(-10);
    if (!String(b.name || '').trim()) throw httpError(400, 'Enter your name');
    if (!PHONE.test(phone)) throw httpError(400, 'Enter a valid 10-digit mobile number');
    const pr = await PrescriptionRequest.create({
      requestNo: `RX${String(await nextSeq('prescription')).padStart(5, '0')}`,
      user: req.user._id,
      image: b.image,
      name: String(b.name).trim().slice(0, 100),
      phone,
      address: String(b.address || '').trim().slice(0, 400),
      notes: String(b.notes || '').trim().slice(0, 500),
    });
    if (!req.user.phoneNumber) {
      req.user.phoneNumber = phone;
      await req.user.save();
    }
    res.status(201).json({ _id: pr._id, requestNo: pr.requestNo });
  } catch (err) {
    next(err);
  }
});

me.get('/prescriptions', async (req, res, next) => {
  try {
    res.json(await PrescriptionRequest.find({ user: req.user._id }).select('-staffNote').sort('-createdAt').limit(30).lean());
  } catch (err) {
    next(err);
  }
});

r.use('/my', me);

module.exports = r;
module.exports.markPaid = markPaid;
