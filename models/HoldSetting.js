const mongoose = require("mongoose");

const HoldSettingSchema = new mongoose.Schema(
  {
    freeHoldDays: {
      type: Number,
      default: 3,
    },

    paidHoldDays: {
      type: Number,
      default: 15,
    },

    paidAmount: {
      type: Number,
      default: 1000,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("HoldSetting", HoldSettingSchema);
