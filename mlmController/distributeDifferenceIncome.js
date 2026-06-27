const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const rankSlabs = require("../utils/rankSlabs");
const getCurrentCycle = require("../utils/getCurrentCycle");

const getRate = (business) => {
  const slab = rankSlabs.find((s) => business >= s.min && business < s.max);

  return slab?.directIncome || 0;
};

const distributeDifferenceIncome = async (
  agentId,
  businessAmount,
  paymentId,
) => {
  try {
    let child = await User.findById(agentId);
    if (!child) return;
    let parentId = child.parent;
    while (parentId) {
      const parent = await User.findById(parentId);
      if (!parent) break;
      const childRate = getRate(child.selfBusiness);
      const parentRate = getRate(parent.selfBusiness);
      const difference = parentRate - childRate;
      if (difference > 0 && parent.status === "active") {
        const income = (businessAmount * difference) / 100;
        // parent.wallet += income;
        parent.walletHold += income;
        const { cycleStart, cycleEnd } = getCurrentCycle();
        await WalletTransaction.create({
          user: parent._id,
          amount: income,
          type: "credit",
          source: "difference_income",
          remark: "Difference Income",
          cycleStart,
          cycleEnd,
          isSettled: false,
        });
        parent.totalIncome += income;
        await parent.save();
        await IncomeHistory.create({
          user: parent._id,
          fromUser: child._id,
          payment: paymentId,
          type: "difference_income",
          percentage: difference,
          businessAmount,
          amount: income,
          status: "credited",
          creditedAt: new Date(),
        });
        console.log(`${parent.name} Difference Income ₹${income}`);
      }

      child = parent;
      parentId = parent.parent;
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = distributeDifferenceIncome;
