const express = require("express");
const router = express.Router();

const Payment = require("../models/Payment");
const User = require("../models/User");
const Booking = require("../models/Booking");
const fetchuser = require("../middleware/fetchUser");
const Colony = require("../models/Colony");
const distributeDirectIncome = require("../mlmController/distributeDirectIncome");
const updateBusinessTree = require("../mlmController/updateBusinessTree");
const distributeDifferenceIncome = require("../mlmController/distributeDifferenceIncome");
const WalletTransaction = require("../models/WalletTransaction");
const distributeMatchingIncome = require("../mlmController/distributeMatchingIncome");
const Withdrawal = require("../models/Withdrawal");
const checkRewards = require("../mlmController/checkRewards");
const generateReceiptNo = require("../utils/generateReceiptNo");
const generateReceipt = require("../utils/generateReceipt");
const { notifyUser, notifyAdmins } = require("../utils/notify");

// =========================
// GET ALL PAYMENTS
// =========================
router.get("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let query = {};

    if (user.role === "admin" || user.role === "staff") {
      query = {};
    } else if (user.role === "agent") {
      query = { agent: user._id };
    } else {
      query = { customer: user._id };
    }

    const payments = await Payment.find(query)
      .populate("customer", "name phone")
      .populate("agent", "name phone")
      .populate({
        path: "booking",
        populate: [
          { path: "location", select: "name" },
          { path: "colony", select: "name layout.plots" },
          { path: "agent", select: "name phone" },
          { path: "customer", select: "name phone" },
        ],
      })
      .populate({
        path: "hold",
        populate: [
          { path: "colony", select: "name layout.plots" },
          { path: "agent", select: "name phone" },
          { path: "customer", select: "name phone" },
        ],
      });

    const paymentsWithPlot = payments.map((payment) => {
      payment = payment.toObject();

      // booking plot
      if (payment.booking?.colony) {
        payment.booking.plot = payment.booking.colony.layout.plots.find(
          (p) => p._id.toString() === payment.booking.plot.toString(),
        );
      }

      // hold plot
      if (payment.hold?.colony) {
        payment.hold.plot = payment.hold.colony.layout.plots.find(
          (p) => p._id.toString() === payment.hold.plotId.toString(),
        );
      }

      return payment;
    });

    res.json(paymentsWithPlot);
  } catch (error) {
    res.status(500).send("Server Error");
    console.log(error, "error");
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
      createdBy: user._id,
    };

    // 🔥 ROLE LOGIC
    if (user.role === "agent") {
      data.status = "pending"; // needs approval
    } else if (user.role === "admin" || user.role === "staff") {
      data.status = "approved"; // auto approved
      data.approvedBy = user._id;
    }

    data.receiptNo = await generateReceiptNo();
    const payment = await Payment.create(data);

    // ======================================================
    // ✅ 🔥 IF AUTO APPROVED → UPDATE BOOKING HERE
    // ======================================================
    if (data.status === "approved") {
      const bookingDoc = await Booking.findById(booking);

      // ✅ 1. UPDATE TOTAL PAID
      bookingDoc.amountPaid += Number(amount);

      // ✅ 2. HANDLE INSTALLMENT
      const schedule = bookingDoc.paymentSchedule[paymentType];

      if (schedule) {
        // 🔥 calculate total paid for this type
        const totalPaidForType = await Payment.aggregate([
          {
            $match: {
              booking: bookingDoc._id,
              paymentType,
              status: "approved",
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
            },
          },
        ]);

        const paidAmount = totalPaidForType[0]?.total || 0;

        if (paidAmount >= schedule.amount) {
          schedule.paid = true;
          schedule.date = new Date();
        }
      }

      // ✅ 3. AUTO CONFIRM BOOKING
      if (bookingDoc.amountPaid >= bookingDoc.finalAmount) {
        bookingDoc.status = "confirmed";

        const colony = await Colony.findById(bookingDoc.colony);

        if (colony) {
          const plot = colony.layout.plots.find(
            (p) => p._id.toString() === bookingDoc.plot.toString(),
          );

          if (plot) {
            plot.plotType = "SOLD";
          }

          await colony.save();
        }
      }

      await bookingDoc.save();
      if (!payment.mlmProcessed && bookingData.agent) {
        await updateBusinessTree(bookingData.agent, payment.amount);

        await distributeDirectIncome(
          bookingData.agent,
          payment.amount,
          payment._id,
        );

        await distributeDifferenceIncome(
          bookingData.agent,
          payment.amount,
          payment._id,
        );

        await distributeMatchingIncome(bookingData.agent);
        await checkRewards(bookingData.agent);

        payment.mlmProcessed = true;
        await payment.save();
      }
    }
    await notifyAdmins({
      sender: user._id,
      title: "Payment Submitted",
      message: `₹${amount} payment submitted for booking.`,
      type: "payment",
      referenceId: payment._id,
      referenceModel: "Payment",
    });

    await notifyUser({
      user: booking.customer,
      sender: user._id,
      title: "Payment Submitted",
      message: `₹${amount} payment has been received and is awaiting approval.`,
      type: "payment",
      referenceId: payment._id,
      referenceModel: "Payment",
    });
    res.json(payment);
  } catch (error) {
    console.log(error);
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

    const dueAmount = booking.finalAmount - paidAmount;

    let dueStatus = "No Due";
    if (paidAmount === 0) dueStatus = "Full Due";
    else if (paidAmount < booking.finalAmount) dueStatus = "Partial Due";

    res.json({
      bookingId,
      totalAmount: booking.finalAmount,
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

    const booking = await Booking.findById(payment.booking);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (payment.status === "approved") {
      return res.status(400).json({
        message: "Payment already approved",
      });
    }

    if (action === "approve") {
      payment.status = "approved";
      payment.approvedBy = user._id;

      // ==========================
      // BOOKING UPDATE
      // ==========================

      booking.amountPaid += payment.amount;

      const schedule = booking.paymentSchedule[payment.paymentType];

      if (schedule) {
        const totalPaidForType = await Payment.aggregate([
          {
            $match: {
              booking: booking._id,
              paymentType: payment.paymentType,
              status: "approved",
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

        const paidAmount = (totalPaidForType[0]?.total || 0) + payment.amount;

        if (paidAmount >= schedule.amount) {
          schedule.paid = true;
          schedule.date = new Date();
        }
      }

      if (booking.amountPaid >= booking.finalAmount) {
        booking.status = "confirmed";
        await notifyAdmins({
          sender: booking.agent,
          title: "Booking Confirmed",
          message: "A booking has been fully completed.",
          type: "booking",
          referenceId: booking._id,
          referenceModel: "Booking",
        });

        await notifyUser({
          user: booking.agent,
          sender: booking.customer,
          title: "Booking Confirmed",
          message: "Congratulations! Your booking is fully completed.",
          type: "booking",
          referenceId: booking._id,
          referenceModel: "Booking",
        });

        await notifyUser({
          user: booking.customer,
          sender: booking.agent,
          title: "Booking Confirmed",
          message: "Congratulations! Your booking has been confirmed.",
          type: "booking",
          referenceId: booking._id,
          referenceModel: "Booking",
        });
        const agent = await User.findById(booking.agent);

        if (agent) {
          agent.ratingPoints += 20;

          await agent.save();
        }
        const colony = await Colony.findById(booking.colony);

        if (colony) {
          const plot = colony.layout.plots.find(
            (p) => p._id.toString() === booking.plot.toString(),
          );

          if (plot) {
            plot.plotType = "SOLD";
          }

          await colony.save();
        }
      }

      await booking.save();

      if (!payment.mlmProcessed && booking.agent) {
        await updateBusinessTree(booking.agent, payment.amount);

        await distributeDirectIncome(
          booking.agent,
          payment.amount,
          payment._id,
        );

        await distributeDifferenceIncome(
          booking.agent,
          payment.amount,
          payment._id,
        );

        await distributeMatchingIncome(booking.agent);
        await checkRewards(booking.agent);

        payment.mlmProcessed = true;
      }
      await notifyUser({
        user: booking.customer,
        sender: user._id,
        title: "Payment Approved",
        message: `Your payment of ₹${payment.amount} has been approved.`,
        type: "payment",
        referenceId: payment._id,
        referenceModel: "Payment",
      });

      await notifyUser({
        user: booking.agent,
        sender: user._id,
        title: "Payment Approved",
        message: "A customer payment has been approved.",
        type: "payment",
        referenceId: payment._id,
        referenceModel: "Payment",
      });
    } else if (action === "reject") {
      payment.status = "rejected";
      await notifyUser({
        user: booking.customer,
        sender: user._id,
        title: "Payment Rejected",
        message: `Your payment of ₹${payment.amount} has been rejected.`,
        type: "payment",
        referenceId: payment._id,
        referenceModel: "Payment",
      });

      await notifyUser({
        user: booking.agent,
        sender: user._id,
        title: "Payment Rejected",
        message: "A customer payment has been rejected.",
        type: "payment",
        referenceId: payment._id,
        referenceModel: "Payment",
      });
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

router.post("/withdraw/request", fetchuser, async (req, res) => {
  const user = await User.findById(req.user.id);
  const { amount } = req.body;

  if (amount > user.wallet) {
    return res.status(400).json({
      msg: "Insufficient wallet",
    });
  }

  const request = await Withdrawal.create({
    user: user._id,
    amount,
  });

  res.json(request);
});

router.put("/withdraw/approve/:id", fetchuser, async (req, res) => {
  const admin = await User.findById(req.user.id);
  if (admin.role !== "admin") {
    return res.status(403).json({
      msg: "Admin only",
    });
  }
  const request = await Withdrawal.findById(req.params.id);
  const user = await User.findById(request.user);
  user.wallet -= request.amount;
  user.totalWithdraw += request.amount;
  await WalletTransaction.create({
    user: user._id,
    amount,
    type: "debit",
    source: "withdrawal",
    remark: "Withdrawal Approved",
  });
  await user.save();
  request.status = "approved";
  request.approvedBy = admin._id;
  await request.save();
  res.json(request);
});

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);

    res.json({ message: "Payment deleted" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

// =======================================
// DOWNLOAD RECEIPT
// =======================================

router.get("/receipt/:id", fetchuser, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("customer")
      .populate("agent")
      .populate("booking")
      .populate({
        path: "hold",
        populate: [
          {
            path: "customer",
          },
          {
            path: "agent",
          },
          {
            path: "colony",
          },
        ],
      });

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    let booking = null;
    let customer = null;
    let colony = null;
    let plot = null;

    //-----------------------------------------------------
    // BOOKING PAYMENT
    //-----------------------------------------------------

    if (payment.booking) {
      booking = await Booking.findById(payment.booking._id);
      customer = payment.customer;
      colony = await Colony.findById(booking.colony);
      plot = colony.layout.plots.id(booking.plot);
    }

    //-----------------------------------------------------
    // HOLD PAYMENT
    //-----------------------------------------------------
    else if (payment.hold) {
      customer = payment.hold.customer;
      colony = await Colony.findById(payment.hold.colony);
      plot = colony.layout.plots.id(payment.hold.plotId);
      booking = {
        finalAmount: plot.price * plot.area,
        pricePerSqft: plot.price,
      };
    }

    if (!colony || !plot) {
      return res.status(404).json({
        message: "Plot not found",
      });
    }

    await generateReceipt(res, payment, booking, customer, colony, plot);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Server Error",
    });
  }
});

module.exports = router;
