const mongoose = require("mongoose");

const OfferSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: String,

    priceValue: {
      type: Number,
      default: 0,
    },

    userType: [
      {
        type: String,
        enum: ["user", "agent"],
      },
    ],

    startDate: Date,

    endDate: Date,

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "offer",
  OfferSchema
);