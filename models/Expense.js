const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema(
  {
    expenseDate: {
      type: Date,
      required: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "Associate Advance Loan",
        "Advertisement",
        "Commission",
        "Development",
        "Driver Payment",
        "Electricity",
        "Festival Bonanza Payout",
        "Land Owner",
        "Layout & Booking Form Expenses",
        "Meeting",
        "Miscellaneous",
        "Office Canteen",
        "Office Rent",
        "Office Setup Expenses",
        "Patna Office Advance",
        "Patna Office Visit Expense",
        "Personal Vehicle Expense",
        "Stationery Expenses",
        "Tour Expense",
      ],
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Colony",
      default: null,
    },

    name: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },

    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Bank Transfer", "Cheque"],
      required: true,
    },

    transactionId: {
      type: String,
      default: "",
    },

    chequeNumber: {
      type: String,
      default: "",
    },

    attachment: {
      type: String,
      default: "",
    },

    remark: {
      type: String,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Expense", ExpenseSchema);
