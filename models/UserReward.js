const mongoose = require("mongoose");

const UserRewardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reward",
      required: true,
    },

    achievedBusiness: {
      type: Number,
      default: 0,
    },

    selectedOption: {
      type: String,
      enum: ["cash", "gift", null],
      default: null,
    },

    status: {
      type: String,
      enum: ["unclaimed", "claimed"],
      default: "unclaimed",
    },

    royaltyActivated: {
      type: Boolean,
      default: false,
    },

    royaltyPercent: {
      type: Number,
      default: 0,
    },

    claimedAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "UserReward",
  UserRewardSchema
);