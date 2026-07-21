const mongoose = require("mongoose");

const RewardOptionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["cash", "reward"],
    required: true,
  },
  title: String,
  description: String,
  value: Number,
});

const MilestoneSchema = new mongoose.Schema({
  conditionType: {
    type: String,
    enum: ["booking", "business", "self_business"],
    required: true,
  },
  bookingCount: {
    type: Number,
    default: 0,
  },
  paymentType: {
    type: String,
    enum: ["booking", "agreement", "full", "percentage"],
    default: "booking",
  },

  paymentPercent: {
    type: Number,
    default: 0,
  },
  businessAmount: {
    type: Number,
    default: 0,
  },
  salesCount: {
    type: Number,
    default: 0,
  },
  rewardMode: {
    type: String,
    enum: ["direct", "choice"],
    default: "direct",
  },
  rewardOptions: [RewardOptionSchema],
  sortOrder: Number,
});

const OfferSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    poster: String,
    colonyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Colony",
      },
    ],
    offerCategory: {
      type: String,
      enum: ["booking", "business", "festival", "general"],
      default: "general",
    },
    milestones: [MilestoneSchema],
    terms: [String],
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "expired"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Offer", OfferSchema);
