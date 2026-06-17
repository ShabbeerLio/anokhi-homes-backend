const express = require("express");
const router = express.Router();

const fetchuser = require("../middleware/fetchUser");

const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const WalletTransaction = require("../models/WalletTransaction");
const rankSlabs = require("../utils/rankSlabs");

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
        totalIncome
        totalBusiness
        selfBusiness
        leftBusiness
        rightBusiness
      `);
    } else if (loggedUser.role === "agent") {
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
        totalIncome
        totalBusiness
        selfBusiness
        leftBusiness
        rightBusiness
      `);
    } else {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    const summary = await Promise.all(
      users.map(async (user) => {
        const histories = await IncomeHistory.find({
          user: user._id,
        });

        const directIncome = histories
          .filter((i) => i.type === "direct_income")
          .reduce((a, b) => a + b.amount, 0);

        const differenceIncome = histories
          .filter((i) => i.type === "difference_income")
          .reduce((a, b) => a + b.amount, 0);

        const matchingIncome = histories
          .filter((i) => i.type === "matching_income")
          .reduce((a, b) => a + b.amount, 0);

        const referralIncome = histories
          .filter((i) => i.type === "referal_income")
          .reduce((a, b) => a + b.amount, 0);

        const rewardIncome = histories
          .filter((i) => i.type === "reward_income")
          .reduce((a, b) => a + b.amount, 0);

        const pendingCommission = histories
          .filter((i) => i.status === "pending")
          .reduce((a, b) => a + b.amount, 0);

        const creditedCommission = histories
          .filter((i) => i.status === "credited")
          .reduce((a, b) => a + b.amount, 0);

        const nextCycleDate =
          histories
            .filter((i) => i.status === "pending" && i.cycleDate)
            .sort((a, b) => new Date(a.cycleDate) - new Date(b.cycleDate))[0]
            ?.cycleDate || null;

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

        return {
          ...user.toObject(),
          currentLevel: currentSlab.level,
          currentDesignation: currentSlab?.designation,
          currentLevel: currentSlab?.level,
          currentRate: currentSlab?.directIncome,
          nextDesignation: nextSlab?.designation || null,
          nextTarget: nextSlab?.min || null,
          remainingForNextRank: nextSlab ? nextSlab.min - user.selfBusiness : 0,
          progress: Math.round(progress),

          directIncome,
          differenceIncome,
          matchingIncome,
          referralIncome,
          rewardIncome,

          totalCommission:
            directIncome +
            differenceIncome +
            matchingIncome +
            referralIncome +
            rewardIncome,

          pendingCommission,
          creditedCommission,

          histories,
          cycleDate: nextCycleDate,
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
