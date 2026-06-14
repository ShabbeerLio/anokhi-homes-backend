const IncomeHistory = require("../models/IncomeHistory");
const User = require("../models/User");

const processCycleIncome = async () => {
  const incomes = await IncomeHistory.find({
    status: "pending",
    cycleDate: {
      $lte: new Date(),
    },
  });
  for (const income of incomes) {
    const user = await User.findById(income.user);
    user.wallet += income.amount;
    user.totalIncome += income.amount;
    await user.save();
    income.status = "credited";
    income.creditedAt = new Date();
    await income.save();
  }
};

module.exports = processCycleIncome;
