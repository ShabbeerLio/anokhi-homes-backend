const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const rankSlabs = require("../utils/rankSlabs");
const WalletTransaction = require("../models/WalletTransaction");
const getCurrentCycle = require("../utils/getCurrentCycle");

const distributeDirectIncome = async (agentId, businessAmount, paymentId) => {
  try {
    const user = await User.findById(agentId);
    if (!user) return;
    // Previous self business already paid on
    const previousBusiness = user.directIncomeBusinessProcessed || 0;
    // Current total self business
    const newBusiness = user.selfBusiness;
    if (newBusiness <= previousBusiness) {
      return;
    }
    let totalIncome = 0;
    let percentage = 0;
    for (const slab of rankSlabs) {
      const start = slab.min;
      const end = slab.max;
      const overlapStart = Math.max(previousBusiness, start);
      const overlapEnd = Math.min(newBusiness, end);
      if (overlapEnd <= overlapStart) {
        continue;
      }
      const slabBusiness = overlapEnd - overlapStart;
      const slabIncome = (slabBusiness * slab.directIncome) / 100;
      totalIncome += slabIncome;
      percentage = slab.directIncome;
    }
    if (totalIncome <= 0) return;
    // Direct income is instan
    // user.wallet += totalIncome;
    user.walletHold += totalIncome;
    const { cycleStart, cycleEnd } = getCurrentCycle();

    await WalletTransaction.create({
      user: user._id,
      amount: totalIncome,
      type: "credit",
      source: "direct_income",
      remark: "Direct Income",
      cycleStart,
      cycleEnd,
      isSettled: false,
    });
    user.totalIncome += totalIncome;
    user.directIncomeBusinessProcessed = newBusiness;
    await user.save();
    await IncomeHistory.create({
      user: user._id,
      payment: paymentId,
      percentage: percentage,
      type: "direct_income",
      businessAmount,
      amount: totalIncome,
      status: "credited",
      creditedAt: new Date(),
    });
    console.log(`${user.name} Direct Income ₹${totalIncome}`);
  } catch (error) {
    console.log(error);
  }
};

module.exports = distributeDirectIncome;
