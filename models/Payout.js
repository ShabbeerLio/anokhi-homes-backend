const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    cycleStart: { type: Date, required: true },
    cycleEnd: { type: Date, required: true },

    directIncome: { type: Number, default: 0 },
    differenceIncome: { type: Number, default: 0 },
    matchingIncome: { type: Number, default: 0 },
    royaltyIncome: { type: Number, default: 0 },
    cashbackIncome: { type: Number, default: 0 },
    bestPerformanceIncome: { type: Number, default: 0 },
    festivalBonusIncome: { type: Number, default: 0 },
    referralIncome: { type: Number, default: 0 },
    rewardIncome: { type: Number, default: 0 },

    grossAmount: { type: Number, default: 0 }, // "Total Income"

    tdsPercent: { type: Number, default: 5 },
    tdsAmount: { type: Number, default: 0 },

    adminChargePercent: { type: Number, default: 2 },
    adminChargeAmount: { type: Number, default: 0 },

    netAmount: { type: Number, default: 0 }, // "Payout Amount"

    status: {
      type: String,
      enum: ["released", "paid", "cancelled"],
      default: "released",
    },
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "bank", "cheque"],
    },
    transactionId: String,

    attachment: String,

    paidAt: Date,
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    remark: String,
  },
  { timestamps: true },
);

payoutSchema.index({ user: 1, cycleStart: 1, cycleEnd: 1 }, { unique: true });

module.exports = mongoose.model("Payout", payoutSchema);
