const mongoose = require("mongoose");

const OfferClaimSchema = new mongoose.Schema(
  {
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
    },

    rewardIndex: Number,

    rewardTarget: Number,

    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    achievedValue: Number,

    selectedReward: {
      type: Object,
      default: null,
    },

    rewardChoice: {
      type: String,
      enum: ["reward", "cash"],
    },

    status: {
      type: String,
      enum: ["eligible", "undelivered", "claimed", "delivered"],
      default: "eligible",
    },

    claimedAt: Date,

    deliveredAt: Date,

    deliveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    remarks: String,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("OfferClaim", OfferClaimSchema);
