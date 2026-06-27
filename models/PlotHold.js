const mongoose = require("mongoose");

const PlotHoldSchema = new mongoose.Schema(
  {
    colony: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Colony",
      required: true,
    },

    plotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plot",
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    holdType: {
      type: String,
      enum: ["FREE", "PAID"],
      required: true,
    },

    amount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "APPROVAL",
        "ACTIVE",
        "APPROVED",
        "REJECTED",
        "EXPIRED",
        "RELEASED",
      ],
      default: "ACTIVE",
    },
    expiresAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    remarks: String,
    releasedAt: Date,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("PlotHold", PlotHoldSchema);
