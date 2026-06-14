const mongoose = require("mongoose");

const RewardSchema = new mongoose.Schema(
  {
    level: Number,

    targetBusiness: Number,

    rewardCash: Number,

    rewardName: String,

    royaltyPercent: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Reward",
  RewardSchema
);