const express = require("express");
const router = express.Router();

const Payment = require("../models/Payment");
const User = require("../models/User");
const Booking = require("../models/Booking");
const fetchuser = require("../middleware/fetchUser");

// =========================
// GET ALL PAYMENTS
// =========================
router.get("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let query = {};

    // 👑 Admin / Staff → ALL
    if (user.role === "admin" || user.role === "staff") {
      query = {};
    }

    // 🧑‍💼 Agent → only their payments
    else if (user.role === "agent") {
      query = { agent: user._id };
    }

    // 👤 Customer → only their payments
    else {
      query = { customer: user._id };
    }

    const payments = await Payment.find(query)
      .populate("customer", "name phone")
      .populate("agent", "name phone")
      .populate("booking")
      .populate("notes.by", "name role");

    res.json(payments);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

// =========================
// ADD PAYMENT
// =========================
router.post("/add", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const { booking, amount, paymentMode, paymentType, transactionId } =
      req.body;

    const bookingData = await Booking.findById(booking);

    if (!bookingData) {
      return res.status(404).json({ message: "Booking not found" });
    }

    let data = {
      booking,
      customer: bookingData.customer,
      agent: bookingData.agent,
      amount,
      paymentMode,
      paymentType,
      transactionId,
      paymentDate: new Date(),
    };

    // 🔥 ROLE LOGIC
    if (user.role === "agent") {
      data.status = "pending"; // needs approval
    } else if (user.role === "admin" || user.role === "staff") {
      data.status = "approved"; // auto approved
    }

    const payment = await Payment.create(data);

    res.json(payment);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.get("/booking/:bookingId", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let query = {
      booking: req.params.bookingId,
    };

    // Agent → restrict
    if (user.role === "agent") {
      query.agent = user._id;
    }

    // Customer → restrict
    if (user.role === "user") {
      query.customer = user._id;
    }

    const payments = await Payment.find(query);

    res.json(payments);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.get("/summary/:bookingId", fetchuser, async (req, res) => {
  try {
    const bookingId = req.params.bookingId;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const payments = await Payment.find({
      booking: bookingId,
      status: "approved",
    });

    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    const dueAmount = booking.totalAmount - paidAmount;

    let dueStatus = "No Due";
    if (paidAmount === 0) dueStatus = "Full Due";
    else if (paidAmount < booking.totalAmount) dueStatus = "Partial Due";

    res.json({
      bookingId,
      totalAmount: booking.totalAmount,
      paidAmount,
      dueAmount,
      dueStatus,
      payments,
    });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.put("/edit/:id", fetchuser, async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json(payment);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.put("/action/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({
        message: "Only admin or staff can take action",
      });
    }

    const { action } = req.body;

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (action === "approve") {
      payment.status = "approved";

      // 🔥 UPDATE BOOKING PAYMENT SCHEDULE
      const booking = await Booking.findById(payment.booking);

      if (booking && booking.paymentSchedule[payment.paymentType]) {
        booking.paymentSchedule[payment.paymentType].paid = true;
        booking.paymentSchedule[payment.paymentType].date = new Date();

        await booking.save();
      }
    } else if (action === "reject") {
      payment.status = "rejected";
    } else {
      return res.status(400).json({
        message: "Invalid action",
      });
    }

    await payment.save();

    res.json(payment);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);

    res.json({ message: "Payment deleted" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;
