const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Colony = require("../models/Colony");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");
const SiteVisit = require("../models/SiteVisit");
const Lead = require("../models/Lead");
const Payment = require("../models/Payment");

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
      bookingDate,
      agreementDate,
      fullDate,
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

    if (!bookingDate || !agreementDate || !fullDate) {
      return res.status(400).json({
        message: "All payment dates are required",
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
    if (plotData.status !== "available") {
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

    // 🔥 DATE DIFFERENCE
    const getDaysDiff = (from, to) => {
      return Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24));
    };

    const bookingDue = getDaysDiff(new Date(), bookingDate);
    const agreementDue = getDaysDiff(bookingDate, agreementDate);
    const fullDue = getDaysDiff(agreementDate, fullDate);

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
          dueDays: bookingDue,
          paid: false,
          date: new Date(bookingDate),
        },
        agreement: {
          percent: 25,
          amount: agreementAmount,
          dueDays: agreementDue,
          paid: false,
          date: new Date(agreementDate),
        },
        full: {
          percent: 65,
          amount: fullAmount,
          dueDays: fullDue,
          paid: false,
          date: new Date(fullDate),
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

    // 🔥 MARK PLOT BOOKED
    plotData.status = "booked";
    await colonyData.save();

    // 🔥 UPDATE SITE VISIT
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

    res.json(booking);
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

      if (plot) plot.status = "available";

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

    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(timeline);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
