const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const checkRewards = require("./checkRewards");

const distributeMatchingIncome = async (
  userId
) => {
  try {
    let currentUser =
      await User.findById(userId);

    while (currentUser) {
      if (
        currentUser.role === "agent" &&
        currentUser.status === "active"
      ) {
        const matchingBusiness =
          Math.min(
            currentUser.leftBusiness,
            currentUser.rightBusiness
          );

        if (matchingBusiness > 0) {
          const matchingIncome =
            (
              matchingBusiness *
              currentUser.directIncomePercent
            ) / 100;

          currentUser.wallet +=
            matchingIncome;

          currentUser.totalIncome +=
            matchingIncome;

          currentUser.rewardBusinessAchieved +=
            matchingBusiness;

          currentUser.leftBusiness -=
            matchingBusiness;

          currentUser.rightBusiness -=
            matchingBusiness;

          await currentUser.save();

          await IncomeHistory.create({
            user: currentUser._id,
            type: "matching_income",
            businessAmount:
              matchingBusiness,
            percentage:
              currentUser.directIncomePercent,
            amount: matchingIncome,
            status: "credited",
            creditedAt: new Date(),
          });

          await checkRewards(
            currentUser
          );
        }
      }

      if (!currentUser.parent) break;

      currentUser =
        await User.findById(
          currentUser.parent
        );
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports =
  distributeMatchingIncome;