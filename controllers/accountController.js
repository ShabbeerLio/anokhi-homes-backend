const Payment = require("../models/Payment");
const Expense = require("../models/Expense");
const Payout = require("../models/Payout");

exports.getAccountStatement = async (req, res) => {
  try {
    const { project, search, fromDate, toDate } = req.query;

    // ================= Payments Query =================
    let paymentQuery = {
      status: "approved",
    };

    if (fromDate || toDate) {
      paymentQuery.paymentDate = {};
      if (fromDate) paymentQuery.paymentDate.$gte = new Date(fromDate);
      if (toDate) paymentQuery.paymentDate.$lte = new Date(toDate);
    }

    // ================= Expenses Query =================
    let expenseQuery = {};
    if (project) {
      expenseQuery.project = project;
    }

    if (fromDate || toDate) {
      expenseQuery.expenseDate = {};
      if (fromDate) expenseQuery.expenseDate.$gte = new Date(fromDate);
      if (toDate) expenseQuery.expenseDate.$lte = new Date(toDate);
    }

    // ================= Payments =================
    const payments = await Payment.find(paymentQuery)
      .populate({
        path: "booking",
        populate: {
          path: "colony",
        },
      })
      .populate("customer");

    // Filter project after populate
    const filteredPayments = project
      ? payments.filter(
          (p) => p.booking?.colony?._id?.toString() === project.toString(),
        )
      : payments;

    // ================= Expenses =================
    const expenses = await Expense.find(expenseQuery)
      .populate("project")
      .populate("createdBy");

    const payouts = await Payout.find({
      status: "paid",
    })
      .populate("user")
      .populate("paidBy");

    // ================= Credit Rows =================
    const paymentRows = filteredPayments.map((item) => ({
      date: item.paymentDate || item.createdAt,
      project: item.booking?.colony,
      projectName: item.booking?.colony?.name || "-",
      particular: `${item.paymentType} Payment`,
      customer: item.customer?.name || "-",
      paymentMode: item.paymentMode,
      credit: item.amount || 0,
      debit: 0,
      type: "payment",
    }));

    // ================= Debit Rows =================
    const expenseRows = expenses.map((item) => ({
      date: item.expenseDate,
      project: item.project,
      projectName: item.project?.name || "-",
      particular: item.type,
      customer: item.name,
      paymentMode: item.paymentMode,
      credit: 0,
      debit: item.amount || 0,
      type: "expense",
    }));

    const payoutRows = payouts.map((item) => ({
      date: item.paidAt || item.updatedAt,
      project: null,
      projectName: "Company Payout",
      particular: "Commission Payout",
      customer: item.user?.name || "-",
      paymentMode: item.paymentMode,
      credit: 0,
      debit: item.netAmount,
      balance: 0,
      type: "payout",
      payout: item,
    }));

    // ================= Merge =================
    let ledger = [...paymentRows, ...expenseRows, ...payoutRows];

    // ================= Sort =================
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    // ================= Search =================
    if (search) {
      const keyword = search.toLowerCase();

      ledger = ledger.filter((item) => {
        return (
          item.projectName?.toLowerCase().includes(keyword) ||
          item.customer?.toLowerCase().includes(keyword) ||
          item.particular?.toLowerCase().includes(keyword) ||
          item.paymentMode?.toLowerCase().includes(keyword)
        );
      });
    }

    // ================= Totals =================
    const totalCredit = ledger.reduce((sum, item) => sum + item.credit, 0);
    const totalDebit = ledger.reduce((sum, item) => sum + item.debit, 0);
    const profit = totalCredit - totalDebit;

    // ================= Running Balance =================
    let runningBalance = 0;

    ledger = ledger.map((item) => {
      runningBalance += item.credit;
      runningBalance -= item.debit;
      return {
        ...item,
        balance: runningBalance,
      };
    });

    return res.status(200).json({
      success: true,
      ledger,
      summary: {
        totalCredit,
        totalDebit,
        profit: Math.abs(profit),
        status: profit >= 0 ? "Profit" : "Loss",
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
