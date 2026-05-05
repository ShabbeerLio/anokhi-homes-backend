const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Colony = require("../models/Colony");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");
const SiteVisit = require("../models/SiteVisit");

router.get("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let query = {};

    if (user.role === "admin" || user.role === "staff") {
      query = {};
    } else if (user.role === "agent") {
      query = { agent: user._id };
    }

    const bookings = await Booking.find(query)
      .populate("customer", "name phone")
      .populate("agent", "name phone")
      .populate("location", "name")
      .populate("colony", "name");

    res.json(bookings);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.post("/add", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const { customer, location, colony, plotId, requestAmount } = req.body;

    // 🔥 GET COLONY
    const colonyData = await Colony.findById(colony);

    if (!colonyData) {
      return res.status(404).json({ message: "Colony not found" });
    }

    // 🔥 FIND PLOT
    const plot = colonyData.layout.plots.find(
      (p) => p._id.toString() === plotId,
    );

    if (!plot) {
      return res.status(404).json({ message: "Plot not found" });
    }

    // 🔥 CHECK AVAILABILITY
    if (plot.status !== "available") {
      return res.status(400).json({
        message: "Plot is not available",
      });
    }

    // 🔥 CALCULATE TOTAL (sqft based)
    const totalAmount = plot.price * plot.area;

    // 🔥 PAYMENT BASE
    const finalAmount = requestAmount || totalAmount;
    const baseAmount = finalAmount * plot.area;

    const bookingAmount = baseAmount * 0.1;
    const agreementAmount = baseAmount * 0.25;
    const fullAmount = baseAmount - bookingAmount - agreementAmount;

    let data = {
      sitevisitId: req.body.sitevisit,
      customer,
      location,
      colony,
      plotId,

      pricePerSqft: plot.price,
      plotArea: plot.area,

      totalAmount,
      requestAmount,

      createdBy: user._id,

      paymentSchedule: {
        booking: {
          percent: 10,
          amount: bookingAmount,
          paid: false,
        },
        agreement: {
          percent: 25,
          amount: agreementAmount,
          dueDays: 30,
          paid: false,
        },
        full: {
          percent: 65,
          amount: fullAmount,
          dueDays: 90,
          paid: false,
        },
      },
    };

    // 🔥 ROLE LOGIC
    if (user.role === "admin" || user.role === "staff") {
      data.agent = req.body.agent;
      data.status = "pending";
    } else if (user.role === "agent") {
      data.agent = user._id;
      data.status = "approval";
    }

    const booking = await Booking.create(data);
    plot.status = "booked";
    await colonyData.save();

    await SiteVisit.findByIdAndUpdate(req.body.sitevisit, {
      status: "completed",
      convertedAt: new Date(),
      $push: {
        notes: {
          text: "Site visit completed",
          by: loggedUser._id,
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

router.delete("/delete-note/:bookingId/:noteId", fetchuser, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

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
});

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);

    res.json({ message: "Booking deleted" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;
