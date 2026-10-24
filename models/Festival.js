const mongoose = require("mongoose");

// One document per festival PER YEAR, so the admin can correct the date
// for each year (Eid, Diwali, Holi etc. move every year).
// `date` is stored as a plain "YYYY-MM-DD" string (IST calendar day)
// so there are no timezone surprises when comparing with "today".
const festivalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    emoji: { type: String, default: "🎉" },
    message: { type: String, default: "" },
    year: { type: Number, required: true },
    date: { type: String, required: true },
    image: { type: String, default: "" },
    // false = date is approximate (moon/lunar based) and admin should verify it
    confirmed: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

festivalSchema.index({ year: 1, name: 1 }, { unique: true });
festivalSchema.index({ date: 1 });

module.exports = mongoose.model("Festival", festivalSchema);
