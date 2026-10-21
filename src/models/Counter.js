const mongoose = require('mongoose');

const Counter = mongoose.model('Counter', new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }));

// Atomic running number, e.g. nextSeq('order') → 1, 2, 3…
async function nextSeq(name) {
  const c = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
}

module.exports = { Counter, nextSeq };
