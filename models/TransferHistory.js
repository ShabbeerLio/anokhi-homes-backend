const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const partySchema = new mongoose.Schema(
  {
    booking: { type: ObjectId, ref: "Booking" },
    customer: { type: ObjectId, ref: "User" },
    customerName: String,
    agent: { type: ObjectId, ref: "User" },
    agentName: String,
    agentReferralId: String,
    plot: ObjectId,
    plotNumber: String,
    colonyName: String,
  },
  { _id: false },
);

const transferHistorySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["plot", "payment", "agent"], required: true },
    booking: { type: ObjectId, ref: "Booking", required: true }, // booking the transfer was done on
    colony: { type: ObjectId, ref: "Colony" },

    from: partySchema, // where it was before
    to: partySchema, // where it is now

    // payment transfers
    payments: [
      {
        _id: false,
        payment: { type: ObjectId, ref: "Payment" },
        amount: Number,
        paymentType: String,
        receiptNo: String,
      },
    ],
    amount: Number,
    sourceAction: { type: String, enum: ["keep", "release"] },

    // plot transfers
    amountBefore: Number,
    amountAfter: Number,

    // agent transfers: commission already credited was not recalculated
    incomeNeedsReview: { type: Boolean, default: false },

    note: { type: String, required: true, trim: true },
    transferredBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

transferHistorySchema.index({ booking: 1, createdAt: -1 });
transferHistorySchema.index({ "from.booking": 1 });
transferHistorySchema.index({ "to.booking": 1 });
transferHistorySchema.index({ colony: 1, "from.plot": 1 });
transferHistorySchema.index({ colony: 1, "to.plot": 1 });

module.exports = mongoose.model("TransferHistory", transferHistorySchema);