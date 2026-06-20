// models/PaymentTerms.js

const mongoose = require("mongoose");

const paymentTermsSchema = new mongoose.Schema(
  {
    bookingDays: {
      type: [Number],
      default: [7, 15],
    },

    agreementDays: {
      type: [Number],
      default: [7, 15, 30],
    },

    fullPaymentDays: {
      type: [Number],
      default: [15, 30, 60],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentTerms", paymentTermsSchema);