const User = require("../models/User");
const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchUser");
const Payout = require("../models/Payout");

// GET /api/payout

router.get("/", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    let query = {};

    if (loggedUser.role !== "admin") {
      query.user = req.user.id;
    }

    const order = {
      payable: 1,
      partial: 2,
      processing: 3,
      hold: 4,
      paid: 5,
      cancelled: 6,
      rejected: 7,
    };

    const payouts = await Payout.find(query)
      .populate("user", "name phone referralId")
      .populate("paidBy", "name");

    payouts.sort((a, b) => order[a.status] - order[b.status]);

    res.json(payouts);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

// GET /api/payout/:id

router.get("/:id", fetchuser, async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id)
      .populate("user")
      .populate("transactions")
      .populate("paidBy", "name");

    if (!payout) {
      return res.status(404).json({
        message: "Payout not found",
      });
    }

    res.json(payout);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// PUT /api/payout/pay/:id
router.post("/pay/:id", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (admin.role !== "admin") {
      return res.status(403).json({
        msg: "Only admin",
      });
    }
    const payout = await Payout.findById(req.params.id);
    if (!payout) {
      return res.status(404).json({
        msg: "Payout not found",
      });
    }
    const user = await User.findById(payout.user);
    const { amount, paymentMode, transactionId, attachment } = req.body;
    if (Number(amount) > payout.balance) {
      return res.status(400).json({
        msg: "Amount exceeds balance",
      });
    }
    payout.payments.push({
      amount,
      paymentMode,
      transactionId,
      attachment,
      paidBy: admin._id,
      paidAt: new Date(),
    });
    payout.totalPaid += Number(amount);
    payout.balance -= Number(amount);
    user.wallet -= Number(amount);
    user.walletHold -= Number(amount);
    if (payout.balance <= 0) {
      payout.status = "paid";
      payout.paidAt = new Date();
    } else {
      payout.status = "partial";
    }
    await payout.save();
    await user.save();
    await WalletTransaction.create({
      user: user._id,
      amount,
      type: "debit",
      source: "payout",
      remark: `Payout Paid (${payout.cycleStart.toLocaleDateString()} - ${payout.cycleEnd.toLocaleDateString()})`,
    });

    await notifyUser({
      user: user._id,
      sender: admin._id,
      title: "Payout Paid",
      message: `₹${amount} has been paid.`,
      type: "payout",
      referenceId: payout._id,
      referenceModel: "Payout",
    });

    res.json(payout);
  } catch (err) {
    console.log(err);

    res.status(500).send("Server Error");
  }
});

// PUT /api/payout/reject/:id

router.put("/reject/:id", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (admin.role !== "admin") {
      return res.status(403).json({
        message: "Only admin allowed",
      });
    }

    const payout = await Payout.findById(req.params.id);

    payout.status = "rejected";

    payout.remarks = req.body.remarks;

    await payout.save();

    res.json({
      message: "Payout rejected",
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// PUT /api/payout/cancel/:id

router.put("/cancel/:id", fetchuser, async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id);

    payout.status = "cancelled";

    await payout.save();

    res.json({
      message: "Cancelled",
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;
