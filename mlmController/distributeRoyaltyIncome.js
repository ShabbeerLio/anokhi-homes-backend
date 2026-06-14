const UserReward = require("../models/UserReward");
const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");

const distributeRoyaltyIncome = async (companyBusiness) => {
  const holders = await UserReward.find({
    royaltyActivated: true,
  });

  for (const holder of holders) {
    const user = await User.findById(holder.user);
    const royaltyIncome = (companyBusiness * holder.royaltyPercent) / 100;
    user.wallet += royaltyIncome;
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
