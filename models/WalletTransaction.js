const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    amount: Number,

    type: {
      type: String,
      enum: ["credit", "debit"],
    },

    source: {
      type: String,
      enum: [
        "direct_income",
        "referal_income",
        "difference_income",
        "matching_income",
        "withdrawal",
        "reward",
        "royalty",
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
