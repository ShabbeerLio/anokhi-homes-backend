const mongoose = require("mongoose");

const birthdaySettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    image: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BirthdaySetting", birthdaySettingSchema);