const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const getCycleDate = require("./getCycleDate");

const distributeBestPerformanceIncome = async (cycle) => {
  try {
    let sortField = cycle === 1 ? "cycle1Business" : "cycle2Business";

    const winner = await User.findOne({
      role: "agent",
    }).sort({
      [sortField]: -1,
    });

    if (!winner) return;

    const business = winner[sortField];

    if (business <= 0) return;

    const amount = business * 0.01;

    await IncomeHistory.create({
      user: winner._id,

      type: "best_performance_income",

      businessAmount: business,

      percentage: 1,

      amount,

      status: "pending",

      cycleDate: getCycleDate(),
    });

    winner[sortField] = 0;

    await winner.save();

    console.log(`${winner.name} got best performance income`);
  } catch (error) {
    console.log(error);
  }
};

module.exports = distributeBestPerformanceIncome;
