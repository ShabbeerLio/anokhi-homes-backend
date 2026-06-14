const cron = require("node-cron");

const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const WalletTransaction = require("../models/WalletTransaction");

cron.schedule("10 0 1,16 * *", async () => {
  try {
    console.log("Running Payout Cycle");
    const pendingIncomes = await IncomeHistory.find({
      status: "pending",
      cycleDate: {
        $lte: new Date(),
      },
    });

    for (const income of pendingIncomes) {
      const user = await User.findById(income.user);
      if (!user) continue;
      user.wallet += income.amount;
      user.totalIncome += income.amount;
      await user.save();
      income.status = "credited";
      income.creditedAt = new Date();
      await income.save();
      await WalletTransaction.create({
        user: user._id,
        amount: income.amount,
        type: "credit",
        source: income.type,
        remark: `${income.type} credited`,
      });
    }
    console.log(`${pendingIncomes.length} incomes credited`);
  } catch (error) {
    console.log(error);
  }
});
