// Minimal Razorpay client (orders + signature checks) using fetch; no SDK needed.
const crypto = require('crypto');
const httpError = require('./httpError');

const keyId = () => process.env.RAZORPAY_KEY_ID;
const keySecret = () => process.env.RAZORPAY_KEY_SECRET;
const enabled = () => !!(keyId() && keySecret());

// amount in ₹; Razorpay works in paise
async function createOrder(amountRupees, receipt, notes = {}) {
  if (!enabled()) throw httpError(503, 'Online payment is not set up yet. Please call us to complete your order.');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: 'INR', receipt: String(receipt).slice(0, 40), notes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[razorpay] create order failed', res.status, data);
    throw httpError(502, 'Could not start the payment. Please try again.');
  }
  return data; // { id, amount, currency, ... }
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Checkout success: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
function verifyPayment(orderId, paymentId, signature) {
  if (!enabled()) return false;
  const expected = crypto.createHmac('sha256', keySecret()).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

// Webhook: signature = HMAC_SHA256(raw body, webhook_secret)
function verifyWebhook(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

module.exports = { enabled, keyId, createOrder, verifyPayment, verifyWebhook };
