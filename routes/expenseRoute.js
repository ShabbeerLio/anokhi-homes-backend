const express = require("express");
const router = express.Router();

const Expense = require("../models/Expense");
const Colony = require("../models/Colony");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");

// =====================================
// GET ALL EXPENSES
// =====================================
router.get("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let query = {};

    if (user.role === "admin" || user.role === "staff") {
      query = {};
    } else {
      query = {
        createdBy: user._id,
      };
    }

    const expenses = await Expense.find(query)
      .populate("project", "name")
      .populate("createdBy", "name role")
      .sort({ expenseDate: -1 });

    res.json(expenses);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

// =====================================
// ADD EXPENSE
// =====================================
router.post("/add", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const {
      expenseDate,
      type,
      project,
      name,
      amount,
      paymentMode,
      transactionId,
      chequeNumber,
      attachment,
      remark,
    } = req.body;

    if (
      ["UPI", "Bank Transfer"].includes(paymentMode) &&
      !transactionId
    ) {
      return res.status(400).json({
        message: "Transaction ID is required.",
      });
    }

    if (
      paymentMode === "Cheque" &&
      !chequeNumber
    ) {
      return res.status(400).json({
        message: "Cheque Number is required.",
      });
    }

    if (project) {
      const colony = await Colony.findById(project);

      if (!colony) {
        return res.status(404).json({
          message: "Project not found",
        });
      }
    }

    const expense = await Expense.create({
      expenseDate,
      type,
      project: project || null,
      name,
      amount,
      paymentMode,
      transactionId:
        paymentMode === "Cash"
          ? ""
          : transactionId || "",
      chequeNumber:
        paymentMode === "Cheque"
          ? chequeNumber
          : "",
      attachment,
      remark,
      createdBy: user._id,
    });

    const populated = await Expense.findById(expense._id)
      .populate("project", "name")
      .populate("createdBy", "name");

    res.json(populated);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

// =====================================
// EDIT EXPENSE
// =====================================
router.put("/edit/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Only admin can edit expenses.",
      });
    }

    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found",
      });
    }

    const {
      expenseDate,
      type,
      project,
      name,
      amount,
      paymentMode,
      transactionId,
      chequeNumber,
      attachment,
      remark,
    } = req.body;

    if (
      ["UPI", "Bank Transfer"].includes(paymentMode) &&
      !transactionId
    ) {
      return res.status(400).json({
        message: "Transaction ID is required.",
      });
    }

    if (
      paymentMode === "Cheque" &&
      !chequeNumber
    ) {
      return res.status(400).json({
        message: "Cheque Number is required.",
      });
    }

    expense.expenseDate = expenseDate;
    expense.type = type;
    expense.project = project || null;
    expense.name = name;
    expense.amount = amount;
    expense.paymentMode = paymentMode;
    expense.transactionId =
      paymentMode === "Cash"
        ? ""
        : transactionId || "";
    expense.chequeNumber =
      paymentMode === "Cheque"
        ? chequeNumber
        : "";
    expense.attachment = attachment;
    expense.remark = remark;

    await expense.save();

    const updated = await Expense.findById(expense._id)
      .populate("project", "name")
      .populate("createdBy", "name");

    res.json(updated);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

// =====================================
// DELETE EXPENSE
// =====================================
router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Only admin can delete expenses.",
      });
    }

    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found",
      });
    }

    await expense.deleteOne();

    res.json({
      success: true,
      message: "Expense deleted successfully.",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

module.exports = router;