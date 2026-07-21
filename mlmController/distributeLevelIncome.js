const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const WalletTransaction = require("../models/WalletTransaction");
const PayoutSetting = require("../models/PayoutSetting");

const levelIncome = [200, 100, 75, 50, 30, 20, 15, 10, 8, 7, 6, 5, 4, 3, 2, 1];

const distributeLevelIncome = async (userId) => {
  try {
    const joinedUser = await User.findById(userId);

    if (!joinedUser) return;

    const setting = await PayoutSetting.findOne();
    const joiningCharge = setting?.joiningCharge || 999;
    let distributedAmount = 0;
    let currentParent = joinedUser.parent;
    let currentLevel = 1;
    while (currentParent && currentLevel <= 16) {
      const parentUser = await User.findById(currentParent);

      if (!parentUser) break;

      const income = levelIncome[currentLevel - 1];
      distributedAmount += income;

      if (parentUser.status === "active") {
        // CREDIT WALLET
        parentUser.wallet += income;
        parentUser.totalIncome += income;

        await parentUser.save();

        // INCOME HISTORY
        await IncomeHistory.create({
          user: parentUser._id,
          fromUser: joinedUser._id,
          level: currentLevel,
          amount: income,
          type: "referal_income",
          status: "credited",
        });

        // WALLET TRANSACTION
        await WalletTransaction.create({
          user: parentUser._id,
          amount: income,
          type: "credit",
          remark: `Level ${currentLevel} referral income from ${joinedUser.name}`,
          status: "completed",
        });
      }

      currentParent = parentUser.parent;
      currentLevel++;
    }
    const admin = await User.findOne({ role: "admin" });

    if (admin) {
      const adminIncome = Math.max(joiningCharge - distributedAmount, 0);

      admin.wallet += adminIncome;
      admin.totalIncome += adminIncome;

      await admin.save();

      await IncomeHistory.create({
        user: admin._id,
        fromUser: joinedUser._id,
        amount: adminIncome,
        type: "referal_income",
        status: "credited",
        level: 0,
      });

      await WalletTransaction.create({
        user: admin._id,
        amount: adminIncome,
        type: "credit",
        remark: `Remaining joining amount from ${joinedUser.name}`,
        status: "completed",
      });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = distributeLevelIncome;
