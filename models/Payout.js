const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cycleStart: Date,
    cycleEnd: Date,
    releaseDate: Date,
    grossAmount: {
      type: Number,
      default: 0,
    },
    tdsPercent: Number,
    tdsAmount: Number,
    adminChargePercent: Number,
    adminChargeAmount: Number,
    netAmount: Number,
    status: {
      type: String,
      enum: ["hold", "released", "cancelled"],
      default: "hold",
    },
    releasedAt: Date,
    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WalletTransaction",
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Payout", payoutSchema);
