const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const RankSlab = require("../models/RankSlab");
const WalletTransaction = require("../models/WalletTransaction");
const getCurrentCycle = require("../utils/getCurrentCycle");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// NOTE: `businessAmount` is no longer written to IncomeHistory (each row now
// stores only the part of the business that fell in its slab), but the
// parameter is kept so existing callers don't break.
const distributeDirectIncome = async (agentId, businessAmount, paymentId) => {
  try {
    const user = await User.findById(agentId);

    if (!user) return;

    const rankSlabs = await RankSlab.find().sort({ min: 1 });

    if (!rankSlabs.length) {
      console.log("No rank slabs configured");
      return;
    }

    const previousBusiness = Number(user.directIncomeBusinessProcessed || 0);
    const newBusiness = Number(user.selfBusiness || 0);
    if (newBusiness <= previousBusiness) {
      return;
    }

    // One segment per slab this payment's business fell into:
    // { percentage: 5, business: 376020, income: 18801 }
    const segments = [];
    const addSegment = (percentage, business) => {
      const income = round2((business * percentage) / 100);
      if (business <= 0 || income <= 0) return;
      segments.push({ percentage, business: round2(business), income });
    };

    if (user.rankType !== "manual") {
      for (const slab of rankSlabs) {
        const start = slab.min;
        const end = slab.max;
        const overlapStart = Math.max(previousBusiness, start);
        const overlapEnd = Math.min(newBusiness, end);
        if (overlapEnd <= overlapStart) {
          continue;
        }
        addSegment(slab.directIncome, overlapEnd - overlapStart);
      }
    } else {
      /*
      =====================================================
      MANUAL RANK
      =====================================================
      */
      const manualLevel = Number(user.level);
      const manualSlab = rankSlabs.find((slab) => slab.level === manualLevel);
      if (!manualSlab) {
        console.log(`Manual rank slab not found for level ${manualLevel}`);
        return;
      }
      const manualSlabSize =
        manualSlab.max === Infinity
          ? Infinity
          : manualSlab.max - manualSlab.min;
      let remainingBusiness = newBusiness - previousBusiness;
      let currentLevelIndex = rankSlabs.findIndex(
        (slab) => slab.level === manualLevel,
      );
      const firstIndex = currentLevelIndex;
      while (remainingBusiness > 0 && currentLevelIndex < rankSlabs.length) {
        const slab = rankSlabs[currentLevelIndex];
        let slabCapacity;
        if (currentLevelIndex === firstIndex) {
          slabCapacity = manualSlabSize;
        } else {
          slabCapacity = slab.max === Infinity ? Infinity : slab.max - slab.min;
        }
        const businessForThisSlab = Math.min(remainingBusiness, slabCapacity);
        addSegment(slab.directIncome, businessForThisSlab);
        remainingBusiness -= businessForThisSlab;
        currentLevelIndex++;
      }
    }

    // Total is the sum of the rounded segments, so wallet === sum of history rows
    const totalIncome = round2(segments.reduce((s, x) => s + x.income, 0));

    if (totalIncome <= 0) {
      return;
    }
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

    // One IncomeHistory row per slab portion, so the agent sees exactly
    // what was earned at each percentage.
    const creditedAt = new Date();
    await IncomeHistory.insertMany(
      segments.map((seg) => ({
        user: user._id,
        payment: paymentId,
        percentage: seg.percentage,
        type: "direct_income",
        businessAmount: seg.business,
        amount: seg.income,
        status: "credited",
        creditedAt,
      })),
    );

    console.log(
      `${user.name} Direct Income ₹${totalIncome} (` +
        segments
          .map((s) => `₹${s.business} @ ${s.percentage}% = ₹${s.income}`)
          .join(", ") +
        ")",
    );
    return segments;
  } catch (error) {
    console.log("Direct income error:", error);
  }
};

module.exports = distributeDirectIncome;
