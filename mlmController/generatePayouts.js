const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const Payout = require("../models/Payout");
const getPayoutCycle = require("../utils/getPayoutCycle");
const getSixMonthCycle = require("../utils/getSixMonthCycle");
const PayoutSetting = require("../models/PayoutSetting");
const distributeBestPerformanceIncome = require("./distributeBestPerformanceIncome");

const REGULAR_TYPE_FIELD_MAP = {
  direct_income: "directIncome",
  difference_income: "differenceIncome",
  cashback_income: "cashbackIncome",
  best_performance_income: "bestPerformanceIncome",
  festival_bonus_income: "festivalBonusIncome",
  referal_income: "referralIncome",
  reward_income: "rewardIncome",
};

const SIX_MONTH_TYPE_FIELD_MAP = {
  matching_income: "matchingIncome",
  royalty_income: "royaltyIncome",
};

const isSixMonthPayoutDate = (date) => {
  const day = date.getDate();
  const month = date.getMonth(); // 0 = Jan, 5 = Jun
  return day === 1 && (month === 0 || month === 5);
};

const generatePayouts = async (referenceDate = new Date()) => {
  const setting = await PayoutSetting.findOne();
  const tdsPercent = setting?.tdsPercent || 2;
  const adminChargePercent = setting?.adminChargePercent || 5;
  const { cycleStart, cycleEnd } = getPayoutCycle(referenceDate);
  const includeSixMonth = isSixMonthPayoutDate(referenceDate);
  const agents = await User.find({
    role: { $in: ["agent", "admin"] },
    status: "active",
  });
  const results = [];
  console.log(
    "this is working",
    cycleStart,
    cycleEnd,
    "sixMonth:",
    includeSixMonth,
  );
  await distributeBestPerformanceIncome(referenceDate);

  for (const agent of agents) {
    const existing = await Payout.findOne({
      user: agent._id,
      cycleStart,
      cycleEnd,
    });
    if (existing) continue;

    const isAdmin = agent.role === "admin";

    //-----------------------------------
    // Regular 15-day income
    //-----------------------------------

    const regularHistories = await IncomeHistory.find({
      user: agent._id,
      payout: null,
      type: { $in: Object.keys(REGULAR_TYPE_FIELD_MAP) },
      createdAt: { $gte: cycleStart, $lte: cycleEnd },
    });

    //-----------------------------------
    // Matching/royalty income, six-month cycle, only on Jan 1 / Jun 1
    //-----------------------------------

    let sixMonthHistories = [];
    if (includeSixMonth) {
      const { cycleStart: smStart, cycleEnd: smEnd } =
        getSixMonthCycle(referenceDate);
      sixMonthHistories = await IncomeHistory.find({
        user: agent._id,
        payout: null,
        type: { $in: Object.keys(SIX_MONTH_TYPE_FIELD_MAP) },
        createdAt: { $gte: smStart, $lte: smEnd },
      });
    }

    const histories = [...regularHistories, ...sixMonthHistories];

    if (histories.length === 0) continue;

    const breakdown = {
      directIncome: 0,
      differenceIncome: 0,
      matchingIncome: 0,
      royaltyIncome: 0,
      cashbackIncome: 0,
      bestPerformanceIncome: 0,
      festivalBonusIncome: 0,
      referralIncome: 0,
      rewardIncome: 0,
    };

    for (const h of histories) {
      const field =
        REGULAR_TYPE_FIELD_MAP[h.type] || SIX_MONTH_TYPE_FIELD_MAP[h.type];
      if (field) breakdown[field] += h.amount;
    }

    const grossAmount = Object.values(breakdown).reduce((a, b) => a + b, 0);
    if (grossAmount <= 0) continue;

    const appliedTdsPercent = isAdmin ? 0 : tdsPercent;
    const appliedAdminChargePercent = isAdmin ? 0 : adminChargePercent;

    const tdsAmount = (grossAmount * appliedTdsPercent) / 100;
    const adminChargeAmount = (grossAmount * appliedAdminChargePercent) / 100;
    const netAmount = grossAmount - tdsAmount - adminChargeAmount;

    const payout = await Payout.create({
      user: agent._id,
      cycleStart,
      cycleEnd,
      ...breakdown,
      grossAmount,
      tdsPercent: appliedTdsPercent,
      tdsAmount,
      adminChargePercent: appliedAdminChargePercent,
      adminChargeAmount,
      netAmount,
      status: "released",
    });

    await IncomeHistory.updateMany(
      { _id: { $in: histories.map((h) => h._id) } },
      { $set: { payout: payout._id } },
    );

    agent.wallet += netAmount;
    await agent.save();
    results.push(payout);
  }
  return results;
};

module.exports = generatePayouts;