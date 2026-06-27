const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const checkRewards = require("./checkRewards");
const getSixMonthCycle = require("../utils/getSixMonthCycle");

const distributeMatchingIncome = async (userId) => {
  try {
    let currentUser = await User.findById(userId);

    while (currentUser) {
      if (currentUser.role === "agent" && currentUser.status === "active") {
        // Available business not already matched
        const availableLeft =
          currentUser.leftBusiness - currentUser.matchedBusiness;

        const availableRight =
          currentUser.rightBusiness - currentUser.matchedBusiness;

        const matchingBusiness = Math.min(availableLeft, availableRight);

        if (matchingBusiness > 0) {
          const matchingIncome =
            (matchingBusiness * currentUser.directIncomePercent) / 100;

          // Credit income
          // currentUser.wallet += matchingIncome;
          currentUser.walletHold += matchingIncome;
          const { cycleStart, cycleEnd } = getSixMonthCycle();
          await WalletTransaction.create({
            user: currentUser._id,
            amount: matchingIncome,
            type: "credit",
            source: "matching_income",
            remark: "Matching Income",
            cycleStart,
            cycleEnd,
            isSettled: false,
          });
          currentUser.totalIncome += matchingIncome;

          // Reward business tracking
          currentUser.rewardBusinessAchieved += matchingBusiness;

          // Mark business as matched
          currentUser.matchedBusiness += matchingBusiness;

          await currentUser.save();

          await IncomeHistory.create({
            user: currentUser._id,
            type: "matching_income",
            businessAmount: matchingBusiness,
            percentage: currentUser.directIncomePercent,
            amount: matchingIncome,
            status: "credited",
            creditedAt: new Date(),
          });

          await checkRewards(currentUser._id);

          console.log(`${currentUser.name} Matching Income ₹${matchingIncome}`);
        }
      }

      if (!currentUser.parent) break;

      currentUser = await User.findById(currentUser.parent);
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = distributeMatchingIncome;
