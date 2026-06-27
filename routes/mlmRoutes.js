const express = require("express");
const router = express.Router();

const fetchuser = require("../middleware/fetchUser");

const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const WalletTransaction = require("../models/WalletTransaction");
const rankSlabs = require("../utils/rankSlabs");
const Payout = require("../models/Payout");
const UserReward = require("../models/UserReward");

/* =================================
   WALLET HISTORY
================================= */

async function getDownlineIds(userId) {
  const ids = [];

  async function traverse(id) {
    const user = await User.findById(id).select("leftChildren rightChildren");

    if (!user) return;

    const children = [...user.leftChildren, ...user.rightChildren];

    for (const childId of children) {
      ids.push(childId);
      await traverse(childId);
    }
  }

  await traverse(userId);

  return ids;
}

router.get("/history", fetchuser, async (req, res) => {
  try {
    const transactions = await WalletTransaction.find({
      user: req.user.id,
    }).sort({
      createdAt: -1,
    });

    res.json(transactions);
  } catch (error) {
    console.log(error);

    res.status(500).send("Internal Server Error");
  }
});

/* =================================
   ADMIN ALL WALLET HISTORY
================================= */

router.get("/all", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (loggedUser.role !== "admin") {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    const transactions = await WalletTransaction.find()
      .populate("user", "name phone email referralId designation")
      .sort({
        createdAt: -1,
      });

    res.json(transactions);
  } catch (error) {
    console.log(error);

    res.status(500).send("Internal Server Error");
  }
});

/* =================================
   MLM DASHBOARD
================================= */

router.get("/dashboard", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (loggedUser.role !== "admin") {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    /* =====================
         TOTAL AGENTS
      ===================== */

    const totalAgents = await User.countDocuments({
      role: "agent",
    });

    /* =====================
         ACTIVE AGENTS
      ===================== */

    const activeAgents = await User.countDocuments({
      role: "agent",
      status: "active",
    });

    /* =====================
         TOTAL COMPANY BUSINESS
      ===================== */

    const business = await User.aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: "$selfBusiness",
          },
        },
      },
    ]);

    const totalCompanyBusiness = business?.[0]?.total || 0;

    /* =====================
         TOTAL WALLET BALANCE
      ===================== */

    const wallet = await User.aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: "$wallet",
          },
        },
      },
    ]);

    const totalWalletBalance = wallet?.[0]?.total || 0;

    /* =====================
         TOTAL PAID INCOME
      ===================== */

    const paidIncome = await IncomeHistory.aggregate([
      {
        $match: {
          status: "credited",
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]);

    const totalPaidIncome = paidIncome?.[0]?.total || 0;

    /* =====================
         TOTAL PENDING INCOME
      ===================== */

    const pendingIncome = await IncomeHistory.aggregate([
      {
        $match: {
          status: "pending",
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]);

    const totalPendingIncome = pendingIncome?.[0]?.total || 0;

    /* =====================
         TODAY JOINING
      ===================== */

    const startOfToday = new Date();

    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();

    endOfToday.setHours(23, 59, 59, 999);

    const todayJoining = await User.countDocuments({
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    });

    /* =====================
         THIS MONTH JOINING
      ===================== */

    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const thisMonthJoining = await User.countDocuments({
      createdAt: {
        $gte: startOfMonth,
      },
    });

    /* =====================
         RESPONSE
      ===================== */

    res.json({
      totalAgents,
      activeAgents,
      totalCompanyBusiness,
      totalWalletBalance,
      totalPaidIncome,
      totalPendingIncome,
      todayJoining,
      thisMonthJoining,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send("Internal Server Error");
  }
});

router.get("/commission/summary", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);
    let users = [];

    //-----------------------------------
    // ADMIN
    //-----------------------------------

    if (loggedUser.role === "admin") {
      users = await User.find({
        role: "agent",
      }).select(`
        name
        email
        phone
        referralId
        designation
        wallet
        walletHold
        totalIncome
        totalBusiness
        selfBusiness
        leftBusiness
        rightBusiness
        matchedBusiness
        rewardBusinessAchieved
        directTeam
        totalTeam
        level
        directIncomePercent
        ratingPoints
        averageRating
        totalRatings
        badge
      `);
    }

    //-----------------------------------
    // AGENT
    //-----------------------------------
    else if (loggedUser.role === "agent") {
      const downlineIds = await getDownlineIds(loggedUser._id);

      users = await User.find({
        _id: {
          $in: [loggedUser._id, ...downlineIds],
        },
      }).select(`
        name
        email
        phone
        referralId
        designation
        wallet
        walletHold
        totalIncome
        totalBusiness
        selfBusiness
        leftBusiness
        rightBusiness
        matchedBusiness
        rewardBusinessAchieved
        directTeam
        totalTeam
        level
        directIncomePercent
        ratingPoints
        averageRating
        totalRatings
        badge
      `);
    }

    //-----------------------------------
    // ACCESS DENIED
    //-----------------------------------
    else {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    //-----------------------------------
    // SUMMARY
    //-----------------------------------

    const summary = await Promise.all(
      users.map(async (user) => {
        //-----------------------------------
        // Income History
        //-----------------------------------

        const histories = await IncomeHistory.find({
          user: user._id,
        }).sort({
          createdAt: -1,
        });

        //-----------------------------------
        // Payouts
        //-----------------------------------

        const payouts = await Payout.find({
          user: user._id,
        }).sort({
          cycleStart: -1,
        });

        //-----------------------------------
        // Rewards
        //-----------------------------------

        const rewards = await UserReward.find({
          user: user._id,
        }).populate("reward");

        //------------------------------------------------------
        // Income Calculations
        //------------------------------------------------------

        const directIncome = histories
          .filter((i) => i.type === "direct_income")
          .reduce((sum, i) => sum + i.amount, 0);

        const differenceIncome = histories
          .filter((i) => i.type === "difference_income")
          .reduce((sum, i) => sum + i.amount, 0);

        const matchingIncome = histories
          .filter((i) => i.type === "matching_income")
          .reduce((sum, i) => sum + i.amount, 0);

        const referralIncome = histories
          .filter((i) => i.type === "referal_income")
          .reduce((sum, i) => sum + i.amount, 0);

        const rewardIncome = histories
          .filter((i) => i.type === "reward_income")
          .reduce((sum, i) => sum + i.amount, 0);

        const royaltyIncome = histories
          .filter((i) => i.type === "royalty_income")
          .reduce((sum, i) => sum + i.amount, 0);

        const cashbackIncome = histories
          .filter((i) => i.type === "cashback_income")
          .reduce((sum, i) => sum + i.amount, 0);

        const bestPerformanceIncome = histories
          .filter((i) => i.type === "best_performance_income")
          .reduce((sum, i) => sum + i.amount, 0);

        //------------------------------------------------------
        // Total Income
        //------------------------------------------------------

        const totalCommission =
          directIncome +
          differenceIncome +
          matchingIncome +
          referralIncome +
          rewardIncome +
          royaltyIncome +
          cashbackIncome +
          bestPerformanceIncome;

        //------------------------------------------------------
        // Pending / Credited Income
        //------------------------------------------------------

        const pendingCommission = histories
          .filter((i) => i.status === "pending")
          .reduce((sum, i) => sum + i.amount, 0);

        const creditedCommission = histories
          .filter((i) => i.status === "credited")
          .reduce((sum, i) => sum + i.amount, 0);

        //------------------------------------------------------
        // Next Cycle Date
        //------------------------------------------------------

        const nextCycleDate =
          histories
            .filter((i) => i.status === "pending" && i.cycleDate)
            .sort((a, b) => new Date(a.cycleDate) - new Date(b.cycleDate))[0]
            ?.cycleDate || null;

        //------------------------------------------------------
        // Wallet Summary
        //------------------------------------------------------

        const walletSummary = {
          wallet: user.wallet,
          walletHold: user.walletHold,
          totalIncome: user.totalIncome,
        };

        //------------------------------------------------------
        // Business Summary
        //------------------------------------------------------

        const businessSummary = {
          selfBusiness: user.selfBusiness,
          leftBusiness: user.leftBusiness,
          rightBusiness: user.rightBusiness,
          totalBusiness: user.totalBusiness,
          matchedBusiness: user.matchedBusiness,
          rewardBusinessAchieved: user.rewardBusinessAchieved,
          directTeam: user.directTeam,
          totalTeam: user.totalTeam,
        };

        //------------------------------------------------------
        // Reward Summary
        //------------------------------------------------------
        const rewardSummary = {
          totalRewards: rewards.length,
          claimedRewards: rewards.filter((r) => r.status === "claimed").length,
          unclaimedRewards: rewards.filter((r) => r.status === "unclaimed")
            .length,
          royaltyActivated: rewards.some((r) => r.royaltyActivated),
          rewards,
        };

        //------------------------------------------------------
        // Rank Summary
        //------------------------------------------------------

        const currentSlab =
          rankSlabs.find(
            (slab) =>
              user.selfBusiness >= slab.min && user.selfBusiness < slab.max,
          ) || rankSlabs[0];

        const nextSlab = rankSlabs.find(
          (slab) => slab.level === currentSlab.level + 1,
        );

        let progress = 100;
        if (nextSlab) {
          progress =
            ((user.selfBusiness - currentSlab.min) /
              (currentSlab.max - currentSlab.min)) *
            100;
        }

        const rankSummary = {
          level: user.level,
          designation: user.designation,
          directIncomePercent: user.directIncomePercent,
          currentRate: currentSlab.directIncome,
          nextDesignation: nextSlab?.designation || null,
          nextTarget: nextSlab?.min || null,
          remainingForNextRank: nextSlab ? nextSlab.min - user.selfBusiness : 0,
          progress: Math.round(progress),
        };

        //------------------------------------------------------
        // Rating Summary
        //------------------------------------------------------

        const ratingSummary = {
          badge: user.badge,
          ratingPoints: user.ratingPoints,
          averageRating: user.averageRating,
          totalRatings: user.totalRatings,
        };

        //------------------------------------------------------
        // Payout Summary
        //------------------------------------------------------

        const grossCommission = payouts.reduce(
          (sum, p) => sum + (p.grossAmount || 0),
          0,
        );

        const totalNetCommission = payouts.reduce(
          (sum, p) => sum + (p.netAmount || 0),
          0,
        );

        const tdsDeducted = payouts.reduce(
          (sum, p) => sum + (p.tdsAmount || 0),
          0,
        );

        const adminDeducted = payouts.reduce(
          (sum, p) => sum + (p.adminChargeAmount || 0),
          0,
        );

        const totalDeduction = tdsDeducted + adminDeducted;

        //------------------------------------------------------
        // Payout Status
        //------------------------------------------------------

        const paidCommission = payouts
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + p.netAmount, 0);

        const holdCommission = payouts
          .filter((p) => p.status === "hold")
          .reduce((sum, p) => sum + p.netAmount, 0);

        const releasedCommission = payouts
          .filter((p) => p.status === "released")
          .reduce((sum, p) => sum + p.netAmount, 0);

        const cancelledCommission = payouts
          .filter((p) => p.status === "cancelled")
          .reduce((sum, p) => sum + p.netAmount, 0);

        //------------------------------------------------------
        // Payout Count
        //------------------------------------------------------

        const totalPayouts = payouts.length;
        const paidPayouts = payouts.filter((p) => p.status === "paid").length;
        const holdPayouts = payouts.filter((p) => p.status === "hold").length;
        const releasedPayouts = payouts.filter(
          (p) => p.status === "released",
        ).length;

        const cancelledPayouts = payouts.filter(
          (p) => p.status === "cancelled",
        ).length;

        //------------------------------------------------------
        // Next Payout
        //------------------------------------------------------

        const nextPayout = payouts.find((p) => p.status === "hold") || null;

        //------------------------------------------------------
        // Payout Summary Object
        //------------------------------------------------------

        const payoutSummary = {
          grossCommission,
          totalNetCommission,
          paidCommission,
          releasedCommission,
          holdCommission,
          cancelledCommission,
          tdsDeducted,
          adminDeducted,
          totalDeduction,
          totalPayouts,
          paidPayouts,
          releasedPayouts,
          holdPayouts,
          cancelledPayouts,
          nextPayout,
        };

        //------------------------------------------------------
        // Income Summary Object
        //------------------------------------------------------

        const incomeSummary = {
          directIncome,
          differenceIncome,
          matchingIncome,
          referralIncome,
          rewardIncome,
          royaltyIncome,
          cashbackIncome,
          bestPerformanceIncome,
          totalCommission,
          pendingCommission,
          creditedCommission,
        };

        //------------------------------------------------------
        // Final Response
        //------------------------------------------------------

        return {
          ...user.toObject(),
          walletSummary,
          businessSummary,
          rankSummary,
          rewardSummary,
          incomeSummary,
          payoutSummary,
          ratingSummary,
          cycleDate: nextCycleDate,
          histories,
          payouts,
        };
      }),
    );

    res.json(summary);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
