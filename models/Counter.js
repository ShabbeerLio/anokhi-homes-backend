const mongoose = require("mongoose");

// Generic named counters. Incrementing with $inc inside findOneAndUpdate is
// atomic, so two payouts created at the same moment can never get the same number.
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);