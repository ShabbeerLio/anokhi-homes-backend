// GET /api/payout

router.get("/", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    let query = {};

    if (loggedUser.role !== "admin") {
      query.user = req.user.id;
    }

    const payouts = await Payout.find(query)
      .populate("user", "name phone referralId")
      .populate("paidBy", "name")
      .sort({ createdAt: -1 });

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
router.post(
  "/pay/:id",
  fetchuser,
  uploadImage.single("attachment"),
  async (req, res) => {
    try {
      const admin = await User.findById(req.user.id);

      if (admin.role !== "admin") {
        return res.status(403).json({
          msg: "Only admin can make payout",
        });
      }

      const payout = await Payout.findById(req.params.id);

      if (!payout) {
        return res.status(404).json({
          msg: "Payout not found",
        });
      }

      if (payout.status === "paid") {
        return res.status(400).json({
          msg: "Already paid",
        });
      }

      const { amount, paymentMode, transactionId } = req.body;

      let attachment = "";

      if (req.file) {
        attachment = req.file.path;
      }

      payout.payments.push({
        amount,
        paymentMode,
        transactionId,
        attachment,
        paidBy: admin._id,
        paidAt: new Date(),
      });

      payout.totalPaid = (payout.totalPaid || 0) + Number(amount);

      payout.balance = payout.netAmount - payout.totalPaid;

      if (payout.balance <= 0) {
        payout.status = "paid";
      } else {
        payout.status = "partial";
      }

      await payout.save();

      res.json(payout);
    } catch (err) {
      console.log(err);
      res.status(500).send("Server Error");
    }
  },
);

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
