const mongoose = require("mongoose");

const payoutSettingSchema = new mongoose.Schema(
  {
    tdsPercent: {
      type: Number,
      default: 2,
    },

    adminChargePercent: {
      type: Number,
      default: 5,
    },

    minimumPayout: {
      type: Number,
      default: 100,
    },

    payoutDay1: {
      type: Number,
      default: 1,
    },

    payoutDay2: {
      type: Number,
      default: 16,
    },
    joiningCharge: {
      type: Number,
      default: 999,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("PayoutSetting", payoutSettingSchema);
