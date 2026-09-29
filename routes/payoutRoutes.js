const express = require("express");
const router = express.Router();

const Payout = require("../models/Payout");
const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const fetchuser = require("../middleware/fetchUser");
const generatePayouts = require("../mlmController/generatePayouts");
const { notifyUser } = require("../utils/notify");
const getDownlineIds = require("../utils/getDownlineIds");

router.post("/generate", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "admin")
      return res.status(403).json({ message: "Admin only" });

    const referenceDate = req.body.date ? new Date(req.body.date) : new Date();
    const payouts = await generatePayouts(referenceDate);
    res.json({ message: `${payouts.length} payout(s) generated`, payouts });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

// router.get("/", fetchuser, async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id);
//     const query = user.role === "admin" ? {} : { user: user._id };
//     const payouts = await Payout.find(query)
//       .populate("user", "name email referralId")
//       .sort({ cycleStart: -1 });
//     res.json(payouts);
//   } catch (error) {
//     res.status(500).send("Server Error");
//   }
// });

router.get("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let query = {};

    if (user.role === "admin") {
      query = {};
    } else if (user.role === "agent") {
      const downlineIds = await getDownlineIds(user._id);
      query = { user: { $in: [user._id, ...downlineIds] } };
    } else {
      query = { user: user._id };
    }

    const payouts = await Payout.find(query)
      .populate("user", "name email referralId")
      .sort({ cycleStart: -1 });
    res.json(payouts);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

//------------------------------------------------------
// GET ONE PAYOUT + the IncomeHistory rows it was built from
// (this is the ONLY route that returns histories — scoped
// to a single payout, not the whole account)
//------------------------------------------------------

router.get("/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const payout = await Payout.findById(req.params.id).populate(
      "user",
      "name email referralId",
    );
    if (!payout) return res.status(404).json({ message: "Payout not found" });

    if (
      user.role !== "admin" &&
      payout.user._id.toString() !== user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const histories = await IncomeHistory.find({
      user: payout.user._id,
    })
      .populate("fromUser", "name referralId")
      .populate({
        path: "payment",
        select: "receiptNo amount booking hold",
        populate: [
          {
            path: "booking",
            select: "colony",
            populate: { path: "colony", select: "name category" },
          },
          {
            path: "hold",
            select: "colony",
            populate: { path: "colony", select: "name category" },
          },
        ],
      })
      .sort({ createdAt: 1 });

    const historiesByType = histories.reduce((acc, h) => {
      if (!acc[h.type]) acc[h.type] = [];
      acc[h.type].push(h);
      return acc;
    }, {});

    //-----------------------------------
    // RAW totals by actual colony category — for transparency display only
    // (e.g. "Anokhi Homes", "Others", "Patliputra" as separate rows)
    //-----------------------------------
    const rawTotals = {};
    histories.forEach((h) => {
      const rawCategory =
        h.payment?.booking?.colony?.category ||
        h.payment?.hold?.colony?.category ||
        "Others";
      rawTotals[rawCategory] = (rawTotals[rawCategory] || 0) + (h.amount || 0);
    });

    // Every raw category rolls into exactly one of 2 PAYABLE buckets.
    // "Patliputra" is its own bucket; everything else ("Anokhi Homes" +
    // "Others" + anything unrecognized) merges into "Anokhi Homes".
    const bucketOf = (rawCategory) =>
      rawCategory === "Patliputra" ? "Patliputra" : "Anokhi Homes";

    const bucketedTotals = { "Anokhi Homes": 0, Patliputra: 0 };
    Object.entries(rawTotals).forEach(([rawCategory, amount]) => {
      bucketedTotals[bucketOf(rawCategory)] += amount;
    });

    const totalIncome =
      bucketedTotals["Anokhi Homes"] + bucketedTotals["Patliputra"];

    const freshBreakdown = Object.entries(bucketedTotals).map(
      ([category, grossAmount]) => {
        const share = totalIncome > 0 ? grossAmount / totalIncome : 0;
        const tdsAmount = (payout.tdsAmount || 0) * share;
        const adminChargeAmount = (payout.adminChargeAmount || 0) * share;
        const netAmount = grossAmount - tdsAmount - adminChargeAmount;
        const status = grossAmount === 0 ? "paid" : "pending";

        return {
          category,
          grossAmount,
          tdsAmount,
          adminChargeAmount,
          netAmount,
          status,
        };
      },
    );

    const validCategories = ["Anokhi Homes", "Patliputra"];
    const needsMigration =
      !payout.categoryPayments ||
      payout.categoryPayments.length !== validCategories.length ||
      payout.categoryPayments.some(
        (c) => !validCategories.includes(c.category),
      ) ||
      payout.categoryPayments.some(
        (c) => c.grossAmount === 0 && c.status !== "paid",
      );

    if (needsMigration) {
      const previouslyPaid = {};
      (payout.categoryPayments || []).forEach((c) => {
        if (c.status === "paid") {
          const bucket = bucketOf(c.category);
          previouslyPaid[bucket] = c;
        }
      });

      payout.categoryPayments = freshBreakdown.map((entry) => {
        const prior = previouslyPaid[entry.category];
        return prior
          ? {
              ...entry,
              status: "paid",
              paymentMode: prior.paymentMode,
              transactionId: prior.transactionId,
              attachment: prior.attachment,
              remark: prior.remark,
              paidAt: prior.paidAt,
              paidBy: prior.paidBy,
            }
          : entry; // entry.status is already "paid" here if grossAmount === 0
      });

      await payout.save();
    }

    const categoryDisplay = Object.entries(rawTotals).map(
      ([rawCategory, grossAmount]) => {
        const bucketCategory = bucketOf(rawCategory);
        const bucketEntry = payout.categoryPayments.find(
          (c) => c.category === bucketCategory,
        );
        const bucketTotal = bucketedTotals[bucketCategory] || 0;
        const share = bucketTotal > 0 ? grossAmount / bucketTotal : 0;

        const tdsAmount = (bucketEntry?.tdsAmount || 0) * share;
        const adminChargeAmount = (bucketEntry?.adminChargeAmount || 0) * share;

        return {
          category: rawCategory,
          grossAmount,
          tdsAmount,
          adminChargeAmount,
          netAmount: grossAmount - tdsAmount - adminChargeAmount,
          status: bucketEntry?.status || "pending",
          paymentMode: bucketEntry?.paymentMode,
          transactionId: bucketEntry?.transactionId,
          paidAt: bucketEntry?.paidAt,
          payBucket: bucketCategory,
          isPayable: rawCategory === bucketCategory,
        };
      },
    );

    res.json({
      ...payout.toObject(),
      histories,
      historiesByType,
      historyCount: histories.length,
      categoryBreakdown: payout.categoryPayments, // 2 real payable buckets — used by the Pay modal's Category select
      categoryDisplay, // up to 3 rows — used by the Classification tab
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/pay-category/:id", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (admin.role !== "admin")
      return res.status(403).json({ message: "Admin only" });

    const { category, paymentMode, transactionId, attachment, remark } =
      req.body;

    if (!category || !["Anokhi Homes", "Patliputra"].includes(category)) {
      return res.status(400).json({ message: "Valid category is required" });
    }
    if (!paymentMode) {
      return res.status(400).json({ message: "Payment mode is required" });
    }

    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ message: "Payout not found" });
    if (payout.status === "paid") {
      return res.status(400).json({ message: "Already fully paid" });
    }

    if (!payout.categoryPayments || payout.categoryPayments.length === 0) {
      return res.status(400).json({
        message:
          "Category breakdown not initialized yet — open the payout details first.",
      });
    }

    const entry = payout.categoryPayments.find((c) => c.category === category);
    if (!entry) {
      return res
        .status(404)
        .json({ message: `No ${category} amount found for this payout` });
    }
    if (entry.status === "paid") {
      return res
        .status(400)
        .json({ message: `${category} portion is already paid` });
    }
    if (entry.grossAmount === 0) {
      return res
        .status(400)
        .json({ message: `${category} has no income to pay` });
    }

    const agent = await User.findById(payout.user);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    agent.wallet -= entry.netAmount;
    agent.totalWithdraw += entry.netAmount;
    await agent.save();

    entry.status = "paid";
    entry.paymentMode = paymentMode;
    entry.transactionId = transactionId || "";
    entry.attachment = attachment || "";
    entry.remark = remark || "";
    entry.paidAt = new Date();
    entry.paidBy = admin._id;

    // Once every bucket is paid, mark the whole payout as paid too.
    const allPaid = payout.categoryPayments.every((c) => c.status === "paid");
    if (allPaid) {
      payout.status = "paid";
      payout.paidAt = new Date();
      payout.paidBy = admin._id;
    }

    await payout.save();

    await notifyUser({
      user: agent._id,
      sender: admin._id,
      title: "Payout paid",
      message: `Your ${category} payout of ₹${entry.netAmount.toFixed(2)} for ${payout.cycleStart.toDateString()} - ${payout.cycleEnd.toDateString()} has been paid.`,
      type: "payout",
      referenceId: payout._id,
      referenceModel: "Payout",
    });

    res.json(payout);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
