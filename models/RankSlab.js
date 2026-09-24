const mongoose = require("mongoose");

const rankSlabSchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      max: 16,
    },

    designation: {
      type: String,
      required: true,
      trim: true,
    },

    min: {
      type: Number,
      required: true,
      min: 0,
    },

    max: {
      type: Number,
      default: Infinity,
    },

    directIncome: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("RankSlab", rankSlabSchema);