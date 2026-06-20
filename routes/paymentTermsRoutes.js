const express = require("express");
const router = express.Router();

const PaymentTerms = require("../models/PaymentTerm");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");

// ======================================
// GET PAYMENT TERMS
// ======================================

router.get("/", async (req, res) => {
  try {
    let terms = await PaymentTerms.findOne();

    if (!terms) {
      terms = await PaymentTerms.create({});
    }

    res.json(terms);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

// ======================================
// CREATE PAYMENT TERMS
// ======================================

router.post("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Only admin can create payment terms",
      });
    }

    const exists = await PaymentTerms.findOne();

    if (exists) {
      return res.status(400).json({
        message: "Payment terms already exist",
      });
    }

    const terms = await PaymentTerms.create(req.body);

    res.json({
      message: "Payment terms created",
      terms,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

// ======================================
// UPDATE PAYMENT TERMS
// ======================================

router.put("/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Only admin can update payment terms",
      });
    }

    const terms = await PaymentTerms.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );

    if (!terms) {
      return res.status(404).json({
        message: "Payment terms not found",
      });
    }

    res.json({
      message: "Payment terms updated",
      terms,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

// ======================================
// DELETE PAYMENT TERMS
// ======================================

router.delete("/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Only admin can delete payment terms",
      });
    }

    const terms = await PaymentTerms.findByIdAndDelete(req.params.id);

    if (!terms) {
      return res.status(404).json({
        message: "Payment terms not found",
      });
    }

    res.json({
      message: "Payment terms deleted",
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;