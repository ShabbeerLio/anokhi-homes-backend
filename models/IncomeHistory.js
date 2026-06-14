const mongoose = require("mongoose");

const incomeHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    level: Number,
    amount: Number,
    percentage: Number,
    businessAmount: Number,
    creditedAt: Date,
    type: {
      type: String,
      enum: [
        "referal_income",
        "direct_income",
        "difference_income",
        "matching_income",
        "royalty_income",
        "reward_income",
        "cashback_income",
        "best_performance_income",
      ],
      default: "referal_income",
    },

    status: {
      type: String,
      enum: ["pending", "credited"],
      default: "credited",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("IncomeHistory", incomeHistorySchema);
