const Counter = require("../models/Counter");

const COUNTER_ID = "payoutInvoice"; // one running sequence for all payouts

// 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB ...
const toLetters = (index) => {
  let s = "";
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

// seq 1 -> PAY20260930-A0001
// seq 9999 -> ...-A9999, seq 10000 -> ...-B0001
const formatInvoiceNo = (cycleEnd, seq) => {
  // same date the statement shows as the cycle end (UTC date of cycleEnd)
  const date = new Date(cycleEnd).toISOString().slice(0, 10).replace(/-/g, "");
  const letters = toLetters(Math.floor((seq - 1) / 9999));
  const number = ((seq - 1) % 9999) + 1;
  return `PAY${date}-${letters}${String(number).padStart(4, "0")}`;
};

// Atomically takes the next number in the sequence.
const getNextInvoiceNo = async (cycleEnd) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: COUNTER_ID },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return formatInvoiceNo(cycleEnd, counter.seq);
};

module.exports = { getNextInvoiceNo, formatInvoiceNo };