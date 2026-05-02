// models/Lead.js

const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: String,
    phone: String,
    email: String,

    source: String,

    status: {
      type: String,
      enum: ["new", "assigned", "rejected", "unassigned", "lost", "converted"],
      default: "new",
    },

    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    assignedAt: Date,

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    isAccepted: {
      type: Boolean,
      default: false,
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
  },
  { timestamps: true },
);

module.exports = mongoose.model("Lead", leadSchema);
