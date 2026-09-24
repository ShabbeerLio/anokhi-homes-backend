// const User = require("../models/User");
// const IncomeHistory = require("../models/IncomeHistory");
// const rankSlabs = require("../utils/rankSlabs");
// const WalletTransaction = require("../models/WalletTransaction");
// const getCurrentCycle = require("../utils/getCurrentCycle");

// const distributeDirectIncome = async (agentId, businessAmount, paymentId) => {
//   try {
//     const user = await User.findById(agentId);
//     if (!user) return;
//     // Previous self business already paid on
//     const previousBusiness = user.directIncomeBusinessProcessed || 0;
//     // Current total self business
//     const newBusiness = user.selfBusiness;
//     if (newBusiness <= previousBusiness) {
//       return;
//     }
//     let totalIncome = 0;
//     let percentage = 0;
//     for (const slab of rankSlabs) {
//       const start = slab.min;
//       const end = slab.max;
//       const overlapStart = Math.max(previousBusiness, start);
//       const overlapEnd = Math.min(newBusiness, end);
//       if (overlapEnd <= overlapStart) {
//         continue;
//       }
//       const slabBusiness = overlapEnd - overlapStart;
//       const slabIncome = (slabBusiness * slab.directIncome) / 100;
//       totalIncome += slabIncome;
//       percentage = slab.directIncome;
//     }
//     if (totalIncome <= 0) return;
//     // Direct income is instan
//     // user.wallet += totalIncome;
//     user.walletHold += totalIncome;
//     const { cycleStart, cycleEnd } = getCurrentCycle();

//     await WalletTransaction.create({
//       user: user._id,
//       amount: totalIncome,
//       type: "credit",
//       source: "direct_income",
//       remark: "Direct Income",
//       cycleStart,
//       cycleEnd,
//       isSettled: false,
//     });
//     user.totalIncome += totalIncome;
//     user.directIncomeBusinessProcessed = newBusiness;
//     await user.save();
//     await IncomeHistory.create({
//       user: user._id,
//       payment: paymentId,
//       percentage: percentage,
//       type: "direct_income",
//       businessAmount,
//       amount: totalIncome,
//       status: "credited",
//       creditedAt: new Date(),
//     });
//     console.log(`${user.name} Direct Income ₹${totalIncome}`);
//   } catch (error) {
//     console.log(error);
//   }
// };

// module.exports = distributeDirectIncome;
const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const RankSlab = require("../models/RankSlab");
const WalletTransaction = require("../models/WalletTransaction");
const getCurrentCycle = require("../utils/getCurrentCycle");

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
    let totalIncome = 0;
    let businessCovered = 0; // tracks how much of (newBusiness - previousBusiness) actually earned income

    if (user.rankType !== "manual") {
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
        businessCovered += slabBusiness;
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
      let processedBusiness = previousBusiness;
      let currentLevelIndex = rankSlabs.findIndex(
        (slab) => slab.level === manualLevel,
      );
      while (remainingBusiness > 0 && currentLevelIndex < rankSlabs.length) {
        const slab = rankSlabs[currentLevelIndex];
        let slabCapacity;
        if (
          currentLevelIndex ===
          rankSlabs.findIndex((s) => s.level === manualLevel)
        ) {
          slabCapacity = manualSlabSize;
        } else {
          slabCapacity = slab.max === Infinity ? Infinity : slab.max - slab.min;
        }
        const businessForThisSlab = Math.min(remainingBusiness, slabCapacity);
        const income = (businessForThisSlab * slab.directIncome) / 100;
        totalIncome += income;
        businessCovered += businessForThisSlab;
        remainingBusiness -= businessForThisSlab;
        processedBusiness += businessForThisSlab;
        currentLevelIndex++;
      }
    }

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
    const effectivePercentage =
      businessCovered > 0 ? (totalIncome / businessCovered) * 100 : 0;

    await IncomeHistory.create({
      user: user._id,
      payment: paymentId,
      percentage: Number(effectivePercentage.toFixed(2)),
      type: "direct_income",
      businessAmount,
      amount: totalIncome,
      status: "credited",
      creditedAt: new Date(),
    });

    console.log(
      `${user.name} Direct Income ₹${totalIncome} (${effectivePercentage.toFixed(2)}%)`,
    );
  } catch (error) {
    console.log("Direct income error:", error);
  }
};

module.exports = distributeDirectIncome;
