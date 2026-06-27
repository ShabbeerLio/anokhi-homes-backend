const mongoose = require("mongoose");

const AgentRatingSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    stars: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    review: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Rating",
  AgentRatingSchema
);