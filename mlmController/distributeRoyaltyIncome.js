const UserReward = require("../models/UserReward");
const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const WalletTransaction = require("../models/WalletTransaction");
const getSixMonthCycle = require("../utils/getSixMonthCycle");

const distributeRoyaltyIncome = async (companyBusiness) => {
  const holders = await UserReward.find({
    royaltyActivated: true,
  });

  for (const holder of holders) {
    const user = await User.findById(holder.user);
    const royaltyIncome = (companyBusiness * holder.royaltyPercent) / 100;
    user.walletHold += royaltyIncome;

    const { cycleStart, cycleEnd } = getSixMonthCycle();

    await WalletTransaction.create({
      user: user._id,
      amount: royaltyIncome,
      type: "credit",
      source: "royalty_income",
      remark: "Royalty Income",
      cycleStart,
      cycleEnd,
      isSettled: false,
    });
    user.totalIncome += royaltyIncome;
    await user.save();
    await IncomeHistory.create({
      user: user._id,
      type: "royalty_income",
      amount: royaltyIncome,
      percentage: holder.royaltyPercent,
      businessAmount: companyBusiness,
      status: "credited",
    });
  }
};

module.exports = distributeRoyaltyIncome;
