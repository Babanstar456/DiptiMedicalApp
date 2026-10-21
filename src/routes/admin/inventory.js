const r = require('express').Router();
const Product = require('../../models/Product');
const StockMovement = require('../../models/StockMovement');
const { changeStock, httpError } = require('./stock');
const { isId } = require('../../utils/crud');

const ADD = ['purchase', 'return'];
const REMOVE = ['damage', 'expired', 'sale'];

// Body: { product, type, quantity (>0), direction ('add'|'remove', only for 'adjustment'), batchNo, expiryDate, unitCost, supplier, reference, note }
r.post('/adjust', async (req, res, next) => {
  try {
    const { product, type, direction, batchNo, expiryDate, unitCost, supplier, reference, note } = req.body || {};
    const qty = Math.floor(Number(req.body?.quantity));
    if (!isId(product)) throw httpError(400, 'Choose a product');
    if (!(qty > 0)) throw httpError(400, 'Quantity must be at least 1');
    if (![...ADD, ...REMOVE, 'adjustment'].includes(type)) throw httpError(400, 'Invalid movement type');

    const adds = ADD.includes(type) || (type === 'adjustment' && direction !== 'remove');
    const updated = await changeStock(product, adds ? qty : -qty, {
      type,
      batchNo,
      expiryDate: expiryDate || undefined,
      unitCost: unitCost === '' || unitCost == null ? undefined : Number(unitCost),
      supplier,
      reference,
      note,
      by: req.user._id,
    });

    // A purchase with batch/expiry/cost details updates the product's current batch info.
    if (type === 'purchase') {
      const set = {};
      if (batchNo) set.batchNo = batchNo;
      if (expiryDate) set.expiryDate = expiryDate;
      if (unitCost) set.costPrice = Number(unitCost);
      if (Object.keys(set).length) await Product.updateOne({ _id: updated._id }, { $set: set });
    }
    res.json({ product: await Product.findById(updated._id).lean() });
  } catch (err) {
    next(err);
  }
});

r.get('/movements', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
    const q = {};
    if (isId(req.query.product)) q.product = req.query.product;
    if (req.query.type) q.type = req.query.type;
    const [items, total] = await Promise.all([
      StockMovement.find(q)
        .populate('product', 'name sku')
        .populate('by', 'displayName email')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StockMovement.countDocuments(q),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    next(err);
  }
});

// Low stock, out of stock, expiring within N days (default 90) and already expired.
r.get('/alerts', async (req, res, next) => {
  try {
    const days = Math.min(365, parseInt(req.query.days, 10) || 90);
    const now = new Date();
    const soon = new Date(now.getTime() + days * 86400000);
    const fields = 'name sku stock reorderLevel batchNo expiryDate rackLocation';
    const [lowStock, expiring, expired] = await Promise.all([
      Product.find({ isActive: true, $expr: { $lte: ['$stock', '$reorderLevel'] } }).select(fields).sort('stock').limit(200).lean(),
      Product.find({ isActive: true, stock: { $gt: 0 }, expiryDate: { $gte: now, $lte: soon } }).select(fields).sort('expiryDate').limit(200).lean(),
      Product.find({ stock: { $gt: 0 }, expiryDate: { $lt: now } }).select(fields).sort('expiryDate').limit(200).lean(),
    ]);
    res.json({ days, lowStock, expiring, expired });
  } catch (err) {
    next(err);
  }
});

// Stock valuation summary
r.get('/summary', async (req, res, next) => {
  try {
    const [s] = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          units: { $sum: '$stock' },
          costValue: { $sum: { $multiply: ['$stock', '$costPrice'] } },
          saleValue: { $sum: { $multiply: ['$stock', '$price'] } },
          outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
        },
      },
    ]);
    res.json(s || { products: 0, units: 0, costValue: 0, saleValue: 0, outOfStock: 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = r;
