// models/Policy.js

const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema({
  heading: String,
  content: String,
});

const policySchema = new mongoose.Schema({

  type: {
    type: String,
    enum: ["privacy", "terms", "refund"],
    required: true,
  },

  title: String,

  lastUpdated: String,

  sections: [sectionSchema],

}, { timestamps: true });

module.exports = mongoose.model("Policy", policySchema);