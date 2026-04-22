// models/Location.js

const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true,
  },

  description: String,

  image: String,

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  }

},
{ timestamps: true }
);

module.exports = mongoose.model("Location", locationSchema);