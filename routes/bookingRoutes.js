const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Colony = require("../models/Colony");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");
const SiteVisit = require("../models/SiteVisit");
const Lead = require("../models/Lead");
const Payment = require("../models/Payment");
const PlotHold = require("../models/PlotHold");
const { notifyUser, notifyAdmins } = require("../utils/notify");
const updateAgentRating = require("../utils/updateAgentRating");

router.get("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let query = {};

    if (user.role === "admin" || user.role === "staff") {
      query = {};
    } else if (user.role === "agent") {
      query = { agent: user._id };
    } else if (user.role === "user") {
      query = { customer: user._id };
    }

    const bookings = await Booking.find(query)
      .populate("customer", "name phone")
      .populate("agent", "name phone")
      .populate("location", "name")
      .populate("colony", "name")
      .populate("notes.by", "name role");

    const populatePlotData = async (booking) => {
      const colonyData = await Colony.findById(booking.colony);

      if (!colonyData) return booking;

      const plotData = colonyData.layout.plots.find(
        (p) => p._id.toString() === booking.plot.toString(),
      );

      if (plotData) {
        booking = booking.toObject();
        booking.plot = plotData;
      }

      return booking;
    };

    const bookingsWithPlotDetails = await Promise.all(
      bookings.map(populatePlotData),
    );

    res.json(bookingsWithPlotDetails);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});
/* =========================
   ADD BOOKING
========================= */

router.post("/add", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const {
      customer,
      location,
      colony,
      plot,
      requestAmount,
      sitevisitId,
      bookingDays,
      agreementDays,
      fullPaymentDays,
      termsAccepted,
    } = req.body;

    // ✅ VALIDATIONS
    if (!plot) {
      return res.status(400).json({ message: "Plot is required" });
    }

    if (!termsAccepted) {
      return res.status(400).json({
        message: "Terms & conditions must be accepted",
      });
    }

    if (!bookingDays || !agreementDays || !fullPaymentDays) {
      return res.status(400).json({
        message: "Please select all payment terms",
      });
    }

    // 🔥 GET COLONY
    const colonyData = await Colony.findById(colony);

    if (!colonyData) {
      return res.status(404).json({ message: "Colony not found" });
    }

    // 🔥 FIND PLOT
    const plotData = colonyData.layout.plots.find(
      (p) => p._id.toString() === plot.toString(),
    );

    if (!plotData) {
      return res.status(404).json({ message: "Plot not found" });
    }

    // 🔥 CHECK AVAILABILITY
    const hold = await PlotHold.findOne({
      colony,
      plotId: plot,
      status: "ACTIVE",
    });

    let isOwnHold = false;

    if (hold) {
      if (
        hold.agent.toString() === user._id.toString() &&
        hold.customer.toString() === customer.toString()
      ) {
        isOwnHold = true;
      } else {
        return res.status(400).json({
          message: "Plot is already held by another agent.",
        });
      }
    }

    if (!isOwnHold && plotData.plotType !== "FOR_SALE") {
      return res.status(400).json({
        message: "Plot is not available",
      });
    }

    // 🔥 CALCULATIONS
    const totalAmount = plotData.price * plotData.area;

    const finalRate = requestAmount || plotData.price;
    const baseAmount = finalRate * plotData.area;

    const bookingAmount = baseAmount * 0.1;
    const agreementAmount = baseAmount * 0.25;
    const fullAmount = baseAmount - bookingAmount - agreementAmount;

    const today = new Date();
    const bookingDate = new Date(today);
    bookingDate.setDate(bookingDate.getDate() + Number(bookingDays));
    const agreementDate = new Date(bookingDate);
    agreementDate.setDate(agreementDate.getDate() + Number(agreementDays));
    const fullDate = new Date(agreementDate);
    fullDate.setDate(fullDate.getDate() + Number(fullPaymentDays));

    // 🔥 DATA OBJECT
    let data = {
      sitevisitId,
      customer,
      location,
      colony,
      plot,

      pricePerSqft: plotData.price,
      plotArea: plotData.area,

      totalAmount,
      finalAmount: baseAmount,
      requestAmount,
      termsAccepted,
      createdBy: user._id,
      paymentSchedule: {
        booking: {
          percent: 10,
          amount: bookingAmount,
          dueDays: Number(bookingDays),
          paid: false,
          date: bookingDate,
        },

        agreement: {
          percent: 25,
          amount: agreementAmount,
          dueDays: Number(agreementDays),
          paid: false,
          date: agreementDate,
        },
        full: {
          percent: 65,
          amount: fullAmount,
          dueDays: Number(fullPaymentDays),
          paid: false,
          date: fullDate,
        },
      },
    };

    // 🔥 ROLE LOGIC
    if (user.role === "admin" || user.role === "staff") {
      data.agent = req.body.agent;
      data.status = "pending";
    } else {
      data.agent = user._id;
      data.status = "approval";
    }
    // 🔥 CREATE BOOKING
    const booking = await Booking.create(data);
    const agent = await User.findById(booking.agent);

    if (user.role === "agent") {
      await notifyAdmins({
        sender: user._id,
        title: "New Booking Request",
        message: `${user.name} created a booking request.`,
        type: "booking",
        referenceId: booking._id,
        referenceModel: "Booking",
      });

      await notifyUser({
        user: booking.customer,
        sender: user._id,
        title: "Booking Created",
        message: "Your booking request has been submitted.",
        type: "booking",
        referenceId: booking._id,
        referenceModel: "Booking",
      });
    } else {
      await notifyUser({
        user: booking.agent,
        sender: user._id,
        title: "New Booking Assigned",
        message: "A booking has been assigned to you.",
        type: "booking",
        referenceId: booking._id,
        referenceModel: "Booking",
      });

      await notifyUser({
        user: booking.customer,
        sender: user._id,
        title: "Booking Created",
        message: "Your booking has been created successfully.",
        type: "booking",
        referenceId: booking._id,
        referenceModel: "Booking",
      });
    }
    if (agent) {
      agent.bookingPoints += 15;
      await agent.save();
      await updateAgentRating(agent._id);
    }
    // ===========================================
    // LINK HOLD PAYMENT (IF ANY)
    // ===========================================
    let holdPayment = null;

    if (hold) {
      holdPayment = await Payment.findOne({
        hold: hold._id,
        isHoldPayment: true,
        status: "approved",
      });
    }

    if (holdPayment) {
      // attach payment to booking
      holdPayment.booking = booking._id;
      await holdPayment.save();
      // add paid amount
      booking.amountPaid += holdPayment.amount;
      // reduce booking installment
      booking.paymentSchedule.booking.amount = Math.max(
        booking.paymentSchedule.booking.amount - holdPayment.amount,
        0,
      );

      // if booking installment completed

      if (booking.paymentSchedule.booking.amount === 0) {
        booking.paymentSchedule.booking.paid = true;
        booking.paymentSchedule.booking.date = new Date();
      }
      await booking.save();

      // ===========================================
      // MLM FOR HOLD PAYMENT
      // ===========================================

      if (!holdPayment.mlmProcessed && booking.agent) {
        await updateBusinessTree(booking.agent, holdPayment.amount);
        await distributeDirectIncome(
          booking.agent,
          holdPayment.amount,
          holdPayment._id,
        );
        await distributeDifferenceIncome(
          booking.agent,
          holdPayment.amount,
          holdPayment._id,
        );
        await distributeMatchingIncome(booking.agent);
        await checkRewards(booking.agent);
        holdPayment.mlmProcessed = true;
        await holdPayment.save();
      }
    }

    // ===========================================
    // RELEASE HOLD
    // ===========================================

    if (hold) {
      hold.status = "RELEASED";
      hold.releasedAt = new Date();
      await hold.save();
    }

    // ===========================================
    // UPDATE PLOT
    // ===========================================

    plotData.plotType = "PENDING";
    await colonyData.save();

    // ===========================================
    // UPDATE SITE VISIT
    // ===========================================

    await SiteVisit.findByIdAndUpdate(sitevisitId, {
      status: "completed",
      convertedAt: new Date(),
      $push: {
        notes: {
          text: "Site visit completed & booking created",

          by: user._id,
        },
      },
    });
  } catch (error) {
    console.log(error);
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

    const { action, note } = req.body;

    let update = {};

    if (action === "approve") {
      update.status = "pending";
    } else if (action === "reject") {
      if (!note) {
        return res.status(400).json({
          message: "Note required for rejection",
        });
      }

      update.status = "rejected";
    } else {
      return res.status(400).json({
        message: "Invalid action",
      });
    }

    if (action === "reject") {
      const bookingData = await Booking.findById(req.params.id);

      const colonyData = await Colony.findById(bookingData.colony);

      const plot = colonyData.layout.plots.find(
        (p) => p.plotId === bookingData.plotId,
      );

      if (plot) plot.plotType = "FOR_SALE";

      await colonyData.save();
    }

    // 🔥 ADD NOTE
    if (note) {
      update.$push = {
        notes: {
          text: note,
          by: user._id,
        },
      };
    }

    const booking = await Booking.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (action === "approve") {
      await notifyUser({
        user: booking.agent,
        sender: user._id,
        title: "Booking Approved",
        message: "Your booking request has been approved.",
        type: "booking",
        referenceId: booking._id,
        referenceModel: "Booking",
      });

      await notifyUser({
        user: booking.customer,
        sender: user._id,
        title: "Booking Approved",
        message: "Your booking has been approved.",
        type: "booking",
        referenceId: booking._id,
        referenceModel: "Booking",
      });
    } else if (action === "reject") {
      await notifyUser({
        user: booking.agent,
        sender: user._id,
        title: "Booking Rejected",
        message: "Your booking request has been rejected.",
        type: "booking",
        referenceId: booking._id,
        referenceModel: "Booking",
      });

      await notifyUser({
        user: booking.customer,
        sender: user._id,
        title: "Booking Rejected",
        message: "Your booking request has been rejected.",
        type: "booking",
        referenceId: booking._id,
        referenceModel: "Booking",
      });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   ADD NOTE TO LEAD
========================= */

router.post("/add-note/:id", fetchuser, async (req, res) => {
  try {
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        message: "Note is required",
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    // 🔥 ROLE CHECK (optional but recommended)
    const loggedUser = await User.findById(req.user.id);

    // Agent can only add note to their own lead
    if (
      loggedUser.role === "agent" &&
      booking.agent?.toString() !== loggedUser._id.toString()
    ) {
      return res.status(403).json({
        message: "Not allowed to add note to this booking",
      });
    }

    // 🔥 ADD NOTE
    booking.notes.push({
      text: note,
      by: loggedUser._id,
    });

    await booking.save();
    await notifyAdmins({
      sender: loggedUser._id,
      title: "Booking Updated",
      message: `${loggedUser.name} added a booking note.`,
      type: "booking",
      referenceId: booking._id,
      referenceModel: "Booking",
    });

    await notifyUser({
      user: booking.customer,
      sender: loggedUser._id,
      title: "Booking Updated",
      message: "A new update has been added to your booking.",
      type: "booking",
      referenceId: booking._id,
      referenceModel: "Booking",
    });
    res.json({
      message: "Note added successfully",
      booking,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/edit-note/:bookingId/:noteId", fetchuser, async (req, res) => {
  try {
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ message: "Note is required" });
    }

    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const loggedUser = await User.findById(req.user.id);

    const noteItem = booking.notes.id(req.params.noteId);
    if (!noteItem) {
      return res.status(404).json({ message: "Note not found" });
    }

    // ✅ Only creator OR admin can edit
    if (
      noteItem.by.toString() !== loggedUser._id.toString() &&
      loggedUser.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not allowed" });
    }

    noteItem.text = note;
    noteItem.editedAt = new Date();

    await booking.save();

    res.json({ message: "Note updated", booking });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.delete(
  "/delete-note/:bookingId/:noteId",
  fetchuser,
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId);
      if (!booking)
        return res.status(404).json({ message: "Booking not found" });

      const loggedUser = await User.findById(req.user.id);

      const noteItem = booking.notes.id(req.params.noteId);
      if (!noteItem) {
        return res.status(404).json({ message: "Note not found" });
      }

      // ✅ Only creator OR admin can delete
      if (
        noteItem.by.toString() !== loggedUser._id.toString() &&
        loggedUser.role !== "admin"
      ) {
        return res.status(403).json({ message: "Not allowed" });
      }

      noteItem.deleteOne();

      await booking.save();

      res.json({ message: "Note deleted", booking });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  },
);

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);

    res.json({ message: "Booking deleted" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.get("/timeline/:bookingId", fetchuser, async (req, res) => {
  try {
    const bookingId = req.params.bookingId;

    // =====================================
    // BOOKING
    // =====================================

    const booking = await Booking.findById(bookingId)
      .populate("customer", "name")
      .populate("agent", "name")
      .populate("createdBy", "name")
      .populate("notes.by", "name");

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    // =====================================
    // SITE VISIT
    // =====================================

    const siteVisit = await SiteVisit.findById(booking.sitevisitId)
      .populate("createdBy", "name")
      .populate("notes.by", "name");

    // =====================================
    // LEAD
    // =====================================

    const lead = await Lead.findById(siteVisit?.lead)
      .populate("assignedBy", "name")
      .populate("agent", "name")
      .populate("rejectedBy", "name")
      .populate("notes.by", "name");

    // =====================================
    // PAYMENTS
    // =====================================

    const payments = await Payment.find({
      booking: bookingId,
    })
      .populate("createdBy", "name")
      .populate("approvedBy", "name");

    // =====================================
    // TIMELINE ARRAY
    // =====================================

    let timeline = [];

    // =====================================
    // LEAD EVENTS
    // =====================================

    if (lead) {
      timeline.push({
        type: "lead_created",
        title: "Lead Created",
        description: `${lead.name} lead added`,
        by: null,
        date: lead.createdAt,
      });

      if (lead.assignedAt) {
        timeline.push({
          type: "lead_assigned",
          title: "Lead Assigned",
          description: `Assigned to ${lead.agent?.name}`,
          by: lead.assignedBy?.name,
          date: lead.assignedAt,
        });
      }

      if (lead.isAccepted) {
        timeline.push({
          type: "lead_accepted",
          title: "Lead Accepted",
          description: `${lead.agent?.name} accepted lead`,
          by: lead.agent?.name,
          date: lead.updatedAt,
        });
      }

      if (lead.status === "rejected") {
        timeline.push({
          type: "lead_rejected",
          title: "Lead Rejected",
          description: "Lead rejected",
          by: lead.rejectedBy?.name,
          date: lead.updatedAt,
        });
      }
    }

    // =====================================
    // SITE VISIT EVENTS
    // =====================================

    if (siteVisit) {
      timeline.push({
        type: "sitevisit_requested",
        title: "Site Visit Requested",
        description: `Visit scheduled for ${siteVisit.visitDate}`,
        by: siteVisit.createdBy?.name,
        date: siteVisit.createdAt,
      });

      if (siteVisit.status === "scheduled") {
        timeline.push({
          type: "sitevisit_approved",
          title: "Site Visit Approved",
          description: "Site visit approved",
          by: null,
          date: siteVisit.updatedAt,
        });
      }

      if (siteVisit.status === "completed") {
        timeline.push({
          type: "sitevisit_completed",
          title: "Site Visit Completed",
          description: "Customer visited site",
          by: null,
          date: siteVisit.updatedAt,
        });
      }
    }

    // =====================================
    // BOOKING EVENTS
    // =====================================

    timeline.push({
      type: "booking_requested",
      title: "Booking Requested",
      description: `Booking created for plot`,
      by: booking.createdBy?.name,
      date: booking.createdAt,
    });

    if (booking.status === "pending") {
      timeline.push({
        type: "booking_approved",
        title: "Booking Approved",
        description: "Booking approved by admin",
        by: null,
        date: booking.updatedAt,
      });
    }

    if (booking.status === "confirmed") {
      timeline.push({
        type: "booking_confirmed",
        title: "Booking Confirmed",
        description: "Booking fully confirmed",
        by: null,
        date: booking.updatedAt,
      });
    }

    // =====================================
    // PAYMENT EVENTS
    // =====================================

    payments.forEach((payment) => {
      timeline.push({
        type: "payment_added",
        title: `${payment.paymentType.toUpperCase()} Payment Added`,
        description: `₹${payment.amount} added via ${payment.paymentMode}`,
        by: payment.createdBy?.name,
        date: payment.createdAt,
      });

      if (payment.status === "approved") {
        timeline.push({
          type: "payment_approved",
          title: `${payment.paymentType.toUpperCase()} Payment Approved`,
          description: `₹${payment.amount} approved`,
          by: payment.approvedBy?.name,
          date: payment.updatedAt,
        });
      }

      if (payment.status === "rejected") {
        timeline.push({
          type: "payment_rejected",
          title: `${payment.paymentType.toUpperCase()} Payment Rejected`,
          description: `₹${payment.amount} rejected`,
          by: payment.approvedBy?.name,
          date: payment.updatedAt,
        });
      }
    });

    // =====================================
    // NOTES
    // =====================================

    booking.notes.forEach((note) => {
      timeline.push({
        type: "booking_note",
        title: "Booking Note Added",
        description: note.text,
        by: note.by?.name,
        date: note.date,
      });
    });

    // =====================================
    // SORT TIMELINE
    // =====================================

    const orderMap = {
      // LEAD
      lead_created: 1,
      lead_assigned: 2,
      lead_accepted: 3,
      lead_rejected: 4,

      // SITE VISIT
      sitevisit_requested: 5,
      sitevisit_approved: 6,
      sitevisit_rescheduled: 7,
      sitevisit_completed: 8,
      sitevisit_rejected: 9,

      // BOOKING
      booking_requested: 10,
      booking_approved: 11,
      booking_rejected: 12,

      // PAYMENTS
      payment_added: 13,
      payment_approved: 14,
      payment_rejected: 15,
      booking_confirmed: 16,
    };

    timeline.sort((a, b) => {
      const orderA = orderMap[a.type] || 999;
      const orderB = orderMap[b.type] || 999;

      // ✅ first sort by module flow
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // ✅ then sort by date inside same type
      return new Date(a.date) - new Date(b.date);
    });

    res.json(timeline);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
