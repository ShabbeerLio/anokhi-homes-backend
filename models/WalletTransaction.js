const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    amount: Number,
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
    },

    source: {
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
        "withdrawal",
      ],
    },
    cycleStart: Date,

    cycleEnd: Date,

    isSettled: {
      type: Boolean,
      default: false,
    },

    payout: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payout",
    },

    remark: String,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("WalletTransaction", schema);
