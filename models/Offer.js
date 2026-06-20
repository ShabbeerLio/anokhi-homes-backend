const mongoose = require("mongoose");

const OfferSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: String,

    // Offer Type
    offerType: {
      type: String,
      enum: ["item", "amount", "percent"],
      required: true,
    },

    // Amount / Percent Value
    offerValue: {
      type: String,
      default: 0,
    },

    colonyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Colony",
      required: true,
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
  },
);

module.exports = mongoose.model("offer", OfferSchema);
