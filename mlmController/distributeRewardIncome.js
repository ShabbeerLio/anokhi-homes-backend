const IncomeHistory = require("../models/IncomeHistory");

const distributeRewardIncome = async (user, rewardAmount, rewardName) => {
  // user.wallet += rewardAmount;
  user.walletHold += rewardAmount;
  const { cycleStart, cycleEnd } = getCurrentCycle();
  WalletTransaction.create({
    source: "reward",
    remark: "Achievement Reward",
    cycleStart,
    cycleEnd,
    isSettled: false,
  });
  user.totalIncome += rewardAmount;

  await user.save();

  await IncomeHistory.create({
    user: user._id,
    type: "reward_income",
    amount: rewardAmount,
    rewardName,
    status: "credited",
    creditedAt: new Date(),
  });
};

module.exports = distributeRewardIncome;
