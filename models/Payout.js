const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    // Receiver
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Cycle
    cycleStart: {
      type: Date,
      required: true,
    },

    cycleEnd: {
      type: Date,
      required: true,
    },

    // Amounts
    grossAmount: {
      type: Number,
      default: 0,
    },

    tdsPercent: {
      type: Number,
      default: 0,
    },

    tdsAmount: {
      type: Number,
      default: 0,
    },

    adminChargePercent: {
      type: Number,
      default: 0,
    },

    adminChargeAmount: {
      type: Number,
      default: 0,
    },

    netAmount: {
      type: Number,
      default: 0,
    },

    // Payout Status
    status: {
      type: String,
      enum: [
        "hold",
        "payable",
        "processing",
        "partial",
        "paid",
        "rejected",
        "cancelled",
      ],
      default: "hold",
    },

    // Payment Details
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "bank", "cheque"],
    },

    paymentType: {
      type: String,
      enum: ["full", "partial"],
      default: "full",
    },

    transactionId: String,
    chequeNumber: String,
    bankName: String,
    remarks: String,
    attachment: String,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    paidAt: Date,
    totalPaid: {
      type: Number,
      default: 0,
    },

    balance: {
      type: Number,
      default: 0,
    },

    releaseDate: Date,

    payments: [
      {
        amount: Number,

        paymentMode: {
          type: String,
          enum: ["cash", "upi", "bank", "cheque"],
        },

        transactionId: String,

        attachment: String,

        paidBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        paidAt: Date,
      },
    ],

    // Wallet transactions included
    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WalletTransaction",
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Payout", payoutSchema);
