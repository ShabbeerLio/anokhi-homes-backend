const mongoose = require("mongoose");

const siteVisitSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
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

    colonies: [
      {
        colony: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Colony",
        },

        status: {
          type: String,
          enum: ["pending", "done"],
          default: "pending",
        },

        completedAt: Date,

        image: String,
      },
    ],

    visitDate: String, // or Date if you prefer

    status: {
      type: String,
      enum: [
        "approval", // requested by agent
        "scheduled", // approved
        "completed",
        "rejected",
        "rescheduled",
      ],
      default: "approval",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    notes: [
      {
        text: String,
        colony: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Colony",
        },
        image: String,
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

module.exports = mongoose.model("SiteVisit", siteVisitSchema);
