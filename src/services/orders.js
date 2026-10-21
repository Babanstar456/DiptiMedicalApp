// Order pricing and numbering shared by the admin counter and the online shop.
const Product = require('../models/Product');
const { nextSeq } = require('../models/Counter');
const httpError = require('../utils/httpError');
const { isId } = require('../utils/crud');
const { todayIST } = require('../utils/dates');

const round2 = (n) => Math.round(n * 100) / 100;
const MAX_QTY = 999;

// items: [{ product, quantity }] → priced lines and totals. Rejects hidden, out-of-stock and unpriced products.
async function priceOrder(rawItems, discountInput = 0) {
  const wanted = (Array.isArray(rawItems) ? rawItems : []).filter((i) => isId(i.product) && Number(i.quantity) > 0);
  if (!wanted.length) throw httpError(400, 'Add at least one product');

  const products = await Product.find({ _id: { $in: wanted.map((i) => i.product) } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items = wanted.map((i) => {
    const p = byId.get(String(i.product));
    if (!p || !p.isActive) throw httpError(400, 'One of the products is no longer available');
    if (!p.inStock) throw httpError(409, `${p.name} is out of stock`);
    if (!(p.price > 0)) throw httpError(409, `${p.name} has no price yet. Please call us to order it.`);
    const quantity = Math.min(MAX_QTY, Math.floor(Number(i.quantity)));
    return { product: p._id, name: p.name, price: p.price, quantity, gstRate: p.gstRate, total: round2(p.price * quantity), rx: !!p.prescriptionRequired };
  });

  const subtotal = round2(items.reduce((s, i) => s + i.total, 0));
  const discount = Math.min(subtotal, Math.max(0, Number(discountInput) || 0));
  const total = round2(subtotal - discount);
  // Prices are GST-inclusive: tax = price − price / (1 + rate)
  const tax = round2(items.reduce((s, i) => s + (i.total - i.total / (1 + (i.gstRate || 0) / 100)), 0) * (subtotal ? total / subtotal : 0));
  const needsPrescription = items.some((i) => i.rx);
  return { items: items.map(({ rx, ...line }) => line), subtotal, discount, tax, total, needsPrescription };
}

async function nextOrderNo() {
  const month = todayIST().slice(0, 7);
  const seq = await nextSeq(`order-${month}`);
  return `DM${month.slice(2).replace('-', '')}-${String(seq).padStart(4, '0')}`;
}

module.exports = { priceOrder, nextOrderNo, round2 };
