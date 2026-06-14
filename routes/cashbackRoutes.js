const express = require("express");
const router = express.Router();

const Cashback = require("../models/Cashback");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");

router.get("/", fetchuser, async (req, res) => {
  try {
    const cashbacks = await Cashback.find()
      .populate("colonyId", "name")
      .sort({ createdAt: -1 });

    res.json(cashbacks);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.post("/add", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (
      admin.role !== "admin" &&
      admin.role !== "staff"
    ) {
      return res.status(403).json({
        message: "Access Denied",
      });
    }

    const {
      colonyId,
      cashbackPercent,
      completeWithinDays,
      startDate,
      endDate,
    } = req.body;

    const cashback = await Cashback.create({
      colonyId,
      cashbackPercent,
      completeWithinDays,
      startDate,
      endDate,
    });

    res.json(cashback);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/edit/:id", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (
      admin.role !== "admin" &&
      admin.role !== "staff"
    ) {
      return res.status(403).json({
        message: "Access Denied",
      });
    }

    const cashback =
      await Cashback.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );

    if (!cashback) {
      return res.status(404).json({
        message: "Cashback not found",
      });
    }

    res.json(cashback);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (
      admin.role !== "admin" &&
      admin.role !== "staff"
    ) {
      return res.status(403).json({
        message: "Access Denied",
      });
    }

    const cashback =
      await Cashback.findByIdAndDelete(
        req.params.id
      );

    if (!cashback) {
      return res.status(404).json({
        message: "Cashback not found",
      });
    }

    res.json({
      success: true,
      message: "Deleted Successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/toggle/:id", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (
      admin.role !== "admin" &&
      admin.role !== "staff"
    ) {
      return res.status(403).json({
        message: "Access Denied",
      });
    }

    const cashback =
      await Cashback.findById(req.params.id);

    if (!cashback) {
      return res.status(404).json({
        message: "Cashback not found",
      });
    }

    cashback.active = !cashback.active;

    await cashback.save();

    res.json(cashback);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;