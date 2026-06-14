const mongoose = require("mongoose");

const CashbackSchema = new mongoose.Schema(
  {
    colonyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Colony",
      required: true,
    },

    cashbackPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },

    completeWithinDays: {
      type: Number,
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("cashback", CashbackSchema);