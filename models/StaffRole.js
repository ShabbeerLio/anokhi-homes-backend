const mongoose = require("mongoose");

const StaffRoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    slug: {
      type: String,
      required: true,
    },

    permissions: [
      {
        type: String,
      },
    ],

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("StaffRole", StaffRoleSchema);