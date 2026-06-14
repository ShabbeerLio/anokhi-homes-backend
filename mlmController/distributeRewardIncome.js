const IncomeHistory = require("../models/IncomeHistory");

const distributeRewardIncome = async (
  user,
  rewardAmount,
  rewardName
) => {
  user.wallet += rewardAmount;

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