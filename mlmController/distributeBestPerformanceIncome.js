const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const WalletTransaction = require("../models/WalletTransaction");
const Payment = require("../models/Payment");
const getPayoutCycle = require("../utils/getPayoutCycle");

const distributeBestPerformanceIncome = async (referenceDate = new Date()) => {
  try {
    const { cycleStart, cycleEnd } = getPayoutCycle(referenceDate);

    //-----------------------------------
    // Duplicate guard FIRST: has any agent already been paid
    // best-performer for this exact cycle window?
    //-----------------------------------

    const alreadyPaid = await IncomeHistory.findOne({
      type: "best_performance_income",
      creditedAt: { $gte: cycleStart, $lte: cycleEnd },
    });
    if (alreadyPaid) {
      return null;
    }

    const topAgentAgg = await Payment.aggregate([
      {
        $match: {
          status: "approved",
          paymentDate: { $gte: cycleStart, $lte: cycleEnd },
          agent: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$agent",
          totalBusiness: { $sum: "$amount" },
        },
      },
      { $sort: { totalBusiness: -1 } },
      { $limit: 1 },
    ]);

    if (!topAgentAgg.length) return null;

    const { _id: winnerId, totalBusiness: business } = topAgentAgg[0];
    if (!business || business <= 0) return null;

    const winner = await User.findById(winnerId);
    if (!winner || winner.role !== "agent" || winner.status !== "active") {
      return null;
    }

    const amount = business * 0.01;

    winner.totalIncome += amount;
    await winner.save();

    await WalletTransaction.create({
      user: winner._id,
      amount,
      type: "credit",
      source: "best_performance_income",
      remark: "Best Performance Income",
      cycleStart,
      cycleEnd,
      isSettled: false,
    });

    // Stamp with a time anchored to the cycle itself (not real "now"),
    // so this row always falls inside [cycleStart, cycleEnd] regardless
    // of when the cron actually executes.
    const anchoredAt = cycleEnd < referenceDate ? cycleEnd : referenceDate;

    const history = await IncomeHistory.create({
      user: winner._id,
      type: "best_performance_income",
      businessAmount: business,
      percentage: 1,
      amount,
      status: "credited",
      creditedAt: anchoredAt,
      createdAt: anchoredAt,
    });

    console.log(`${winner.name} got best performance income ₹${amount}`);
    return history;
  } catch (error) {
    console.log(error);
    return null;
  }
};

module.exports = distributeBestPerformanceIncome;