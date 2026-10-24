const mongoose = require("mongoose");

// Events organised by admin. Dates are "YYYY-MM-DD" strings (IST).
// endDate defaults to date, so a one-day event has date === endDate.
const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    image: { type: String, default: "" },
    date: { type: String, required: true },
    endDate: { type: String, required: true },
    audience: { type: String, enum: ["all", "selected"], default: "all" },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

eventSchema.index({ date: 1, endDate: 1 });

module.exports = mongoose.model("Event", eventSchema);