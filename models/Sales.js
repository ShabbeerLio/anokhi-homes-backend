const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    customerName: String,

    project: String,

    plotNumber: String,

    amount: Number,

    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "approved",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "Sale",
  saleSchema,
);