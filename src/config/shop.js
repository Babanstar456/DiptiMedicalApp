// Shop-wide settings shown to customers and enforced on the server. Override any of them in .env / Vercel.
module.exports = {
  name: 'Dipti Medical',
  phone: process.env.SHOP_PHONE || '8001506000',
  email: process.env.SHOP_EMAIL || 'digital.diptimedical@gmail.com',
  minOrderValue: Number(process.env.MIN_ORDER_VALUE || 200), // ₹, before payment
  consultTokenAmount: Number(process.env.CONSULT_TOKEN_AMOUNT || 100), // ₹, paid online to book a doctor
  bookingDaysAhead: 30,
  paymentHoldMinutes: 15, // an unpaid booking holds its slot this long
};
