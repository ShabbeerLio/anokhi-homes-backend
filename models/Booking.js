// models/Booking.js

const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    sitevisitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SiteVisit",
      // required: true,
    },
    holdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SiteVisit",
      // required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },

    colony: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Colony",
      required: true,
    },
    plot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plot",
      required: true,
    },

    pricePerSqft: Number,
    plotArea: Number,

    totalAmount: Number,
    finalAmount: Number,

    requestAmount: Number,
    termsAccepted: {
      type: Boolean,
      default: false,
    },

    amountPaid: {
      type: Number,
      default: 0,
    },
    bookingDays: {
      type: Number,
      default: 7,
    },

    agreementDays: {
      type: Number,
      default: 15,
    },

    fullPaymentDays: {
      type: Number,
      default: 30,
    },

    status: {
      type: String,
      enum: ["approval", "pending", "confirmed", "rejected"],
      default: "approval",
    },

    paymentSchedule: {
      booking: {
        percent: Number,
        amount: Number,
        dueDays: Number,
        paid: Boolean,
        date: Date,
      },

      agreement: {
        percent: Number,
        amount: Number,
        dueDays: Number,
        paid: Boolean,
        date: Date,
      },

      full: {
        percent: Number,
        amount: Number,
        dueDays: Number,
        paid: Boolean,
        date: Date,
      },
    },

    notes: [
      {
        text: String,
        date: {
          type: Date,
          default: Date.now,
        },
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
