// models/Colony.js

const mongoose = require("mongoose");

const colonySchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    image: String,

    area: String,

    priceRange: String,

    layout: {
      mainPlot: {
        id: {
          type: String,
          default: "MAIN",
        },

        plotType: {
          type: String,
          enum: ["NOT_FOR_SALE"],
          default: "NOT_FOR_SALE",
        },

        points: {
          type: [[Number]],
          default: [],
        },

        area: Number,
      },

      plots: [
        {
          plotId: String, // P-1, P-2 etc

          plotNumber: String,

          plotType: {
            type: String,
            enum: [
              "FOR_SALE",
              "HOLD",
              "SOLD",
              "PENDING",
              "ROAD",
              "NOT_FOR_SALE",
            ],
            default: "FOR_SALE",
          },

          points: {
            type: [[Number]],
            required: true,
          },

          area: Number,

          priceRange: {
            min: Number,
            max: Number,
          },

          price: Number,
        },
      ],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Colony", colonySchema);
