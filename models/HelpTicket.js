const mongoose = require("mongoose");

const ReplySchema = new mongoose.Schema(
  {
    title: String,
    message: {
      type: String,
      required: true,
    },
    attachments: [String],

    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "staff", "agent", "user"],
    },
  },
  { timestamps: true },
);

const HelpTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
    },
    type: {
      type: String,
      enum: ["Finance", "Profile Update", "Emergency Payout", "Other"],
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    attachments: [String],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: {
      type: String,
      enum: ["Open", "Response", "Replied", "Closed"],
      default: "Open",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    replies: [ReplySchema],
  },
  {
    timestamps: true,
  },
);

HelpTicketSchema.pre("save", async function () {
  if (!this.ticketId) {
    this.ticketId =
      "#" + Math.random().toString(36).substring(2, 7).toUpperCase();
  }
});

module.exports = mongoose.model("HelpTicket", HelpTicketSchema);
