const mongoose = require("mongoose");

const DiscountSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: String,

    amount: Number,

    type: {
      type: String,
      enum: ["percentage", "fixed"],
    },

    terms: String,

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
  "discount",
  DiscountSchema
);