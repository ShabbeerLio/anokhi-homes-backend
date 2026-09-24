// const UserReward = require("../models/UserReward");
// const User = require("../models/User");
// const IncomeHistory = require("../models/IncomeHistory");
// const WalletTransaction = require("../models/WalletTransaction");
// const getSixMonthCycle = require("../utils/getSixMonthCycle");

// const distributeRoyaltyIncome = async (companyBusiness) => {
//   const holders = await UserReward.find({
//     royaltyActivated: true,
//   });

//   for (const holder of holders) {
//     const user = await User.findById(holder.user);
//     const royaltyIncome = (companyBusiness * holder.royaltyPercent) / 100;
//     user.wallet += royaltyIncome;

//     const { cycleStart, cycleEnd } = getSixMonthCycle();

//     await WalletTransaction.create({
//       user: user._id,
//       amount: royaltyIncome,
//       type: "credit",
//       source: "royalty_income",
//       remark: "Royalty Income",
//       cycleStart,
//       cycleEnd,
//       isSettled: false,
//     });
//     user.totalIncome += royaltyIncome;
//     await user.save();
//     await IncomeHistory.create({
//       user: user._id,
//       type: "royalty_income",
//       amount: royaltyIncome,
//       percentage: holder.royaltyPercent,
//       businessAmount: companyBusiness,
//       status: "credited",
//     });
//   }
// };

// module.exports = distributeRoyaltyIncome;

const UserReward = require("../models/UserReward");
const User = require("../models/User");
const Payment = require("../models/Payment");
const IncomeHistory = require("../models/IncomeHistory");
const WalletTransaction = require("../models/WalletTransaction");

//-----------------------------------------------------
// Previous, now-closed six-month cycle
// Called on Jan 1  -> settles Jul 1–Dec 31 of last year
// Called on Jun 1... boundary still unresolved, see note below
//-----------------------------------------------------

const getPreviousSixMonthCycle = (referenceDate = new Date()) => {
  const month = referenceDate.getMonth(); // 0 = Jan, 5 = Jun
  const year = referenceDate.getFullYear();

  if (month === 0) {
    return {
      cycleStart: new Date(year - 1, 6, 1, 0, 0, 0, 0),
      cycleEnd: new Date(year - 1, 11, 31, 23, 59, 59, 999),
    };
  }

  // temporary: treat Jun 1 as closing Jan 1–May 31
  // flagged as unresolved in the prior message — confirm this is right
  return {
    cycleStart: new Date(year, 0, 1, 0, 0, 0, 0),
    cycleEnd: new Date(year, 4, 31, 23, 59, 59, 999),
  };
};

const distributeRoyaltyIncome = async (referenceDate = new Date()) => {
  try {
    const { cycleStart, cycleEnd } = getPreviousSixMonthCycle(referenceDate);

    //-----------------------------------
    // Company business for the cycle
    //-----------------------------------

    const businessAgg = await Payment.aggregate([
      {
        $match: {
          status: "approved",
          paymentDate: { $gte: cycleStart, $lte: cycleEnd },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const companyBusiness = businessAgg[0]?.total || 0;

    if (companyBusiness <= 0) {
      console.log("No company business in this cycle, skipping royalty");
      return [];
    }

    //-----------------------------------
    // Pay every active royalty holder
    //-----------------------------------

    const holders = await UserReward.find({ royaltyActivated: true });
    const results = [];

    for (const holder of holders) {
      //-----------------------------------
      // Skip if this holder was already paid for this exact cycle
      //-----------------------------------

      const alreadyPaid = await IncomeHistory.findOne({
        user: holder.user,
        type: "royalty_income",
        creditedAt: { $gte: cycleStart, $lte: cycleEnd },
      });
      if (alreadyPaid) continue;

      const user = await User.findById(holder.user);
      if (!user) continue;

      const royaltyIncome = (companyBusiness * holder.royaltyPercent) / 100;
      if (royaltyIncome <= 0) continue;

      user.wallet += royaltyIncome;
      user.totalIncome += royaltyIncome;
      await user.save();

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

      const history = await IncomeHistory.create({
        user: user._id,
        type: "royalty_income",
        amount: royaltyIncome,
        percentage: holder.royaltyPercent,
        businessAmount: companyBusiness,
        status: "credited",
        creditedAt: new Date(),
      });

      results.push(history);
      console.log(`${user.name} Royalty Income ₹${royaltyIncome}`);
    }

    return results;
  } catch (error) {
    console.log(error);
    return [];
  }
};

module.exports = distributeRoyaltyIncome;
