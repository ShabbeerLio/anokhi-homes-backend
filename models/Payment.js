const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    hold: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlotHold",
      default: null,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    amount: Number,

    paymentMode: {
      type: String,
      enum: ["cash", "upi", "bank", "cheque"],
    },
    paymentType: {
      type: String,
      enum: ["booking", "agreement", "full", "hold"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    transactionId: String,

    attachment: String,

    paymentDate: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isHoldPayment: {
      type: Boolean,
      default: false,
    },

    receiptNo: {
      type: String,
      unique: true,
      sparse: true,
    },

    mlmProcessed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Payment", paymentSchema);
