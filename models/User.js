const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      unique: true,
    },
    phone: String,
    password: String,

    role: {
      type: String,
      enum: ["admin", "agent", "staff", "user"],
      default: "user",
    },

    avatar: String,

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    address: String,

    staffRole: {
      type: String,
      enum: [
        "lead_manager",
        "plot_manager",
        "sales_manager",
        "account_manager",
        "operations",
      ],
    },

    teamLeader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
