const express = require("express");
const router = express.Router();
const Colony = require("../models/Colony");
const Booking = require("../models/Booking");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");
const syncBookingsWithPlots = require("../utils/syncBookingsWithPlots");

const adminOrStaff = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("role");
    if (!user || !["admin", "staff"].includes(user.role)) {
      return res
        .status(403)
        .json({ message: "Only admin or staff can edit layouts" });
    }
    next();
  } catch (e) {
    res.status(500).send("Server Error");
  }
};

/* =============================
   GET FULL LAYOUT
============================= */
router.get("/:colonyId", async (req, res) => {
  try {
    const colony = await Colony.findById(req.params.colonyId);
    if (!colony) return res.status(404).json({ message: "Colony not found" });

    res.json(colony.layout);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =============================
   SAVE / UPDATE FULL LAYOUT
   (ADD + EDIT PLOTS + MAINPLOT)
   + keeps active bookings in sync with edited plots
============================= */
router.post("/save/:colonyId", fetchuser, adminOrStaff, async (req, res) => {
  try {
    const { layout } = req.body;

    if (!layout || !Array.isArray(layout.plots)) {
      return res.status(400).json({ message: "Invalid layout" });
    }

    const existing = await Colony.findById(req.params.colonyId);
    if (!existing) return res.status(404).json({ message: "Colony not found" });

    // plots as they were before this save
    const oldPlots = (existing.layout?.plots || []).map((p) => p.toObject());
    const beforeById = new Map(oldPlots.map((p) => [String(p._id), p]));
    const oldByPlotId = new Map(
      oldPlots.filter((p) => p.plotId).map((p) => [p.plotId, p]),
    );

    // a plot sent without _id but with a known plotId keeps its old _id,
    // otherwise its bookings would lose the link to it
    layout.plots = layout.plots.map((p) => {
      if (p._id) return p;
      const old = p.plotId ? oldByPlotId.get(p.plotId) : null;
      return old ? { ...p, _id: old._id } : p;
    });

    const colony = await Colony.findByIdAndUpdate(
      req.params.colonyId,
      { layout },
      { new: true },
    );

    // plots whose area, price or PLC flag changed
    const changes = [];
    colony.layout.plots.forEach((p) => {
      const after = p.toObject();
      const before = beforeById.get(String(after._id));
      if (!before) return; // new plot

      const changed =
        Number(before.area) !== Number(after.area) ||
        Number(before.price) !== Number(after.price) ||
        !!before.plc !== !!after.plc;

      if (changed) changes.push({ before, after });
    });

    if (changes.length) {
      await syncBookingsWithPlots(colony._id, changes, req.user.id);
    }

    res.json(colony.layout);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =============================
   DELETE PLOT
============================= */
router.delete(
  "/delete/:colonyId/:plotId",
  fetchuser,
  adminOrStaff,
  async (req, res) => {
    try {
      const colony = await Colony.findById(req.params.colonyId);
      if (!colony) return res.status(404).json({ message: "Colony not found" });

      // accepts the plot's _id or its plotId
      const key = req.params.plotId;
      const plot = colony.layout.plots.find(
        (p) => String(p._id) === key || p.plotId === key,
      );
      if (!plot) return res.status(404).json({ message: "Plot not found" });

      const active = await Booking.countDocuments({
        colony: colony._id,
        plot: plot._id,
        status: { $in: ["approval", "pending", "confirmed"] },
      });
      if (active) {
        return res.status(400).json({
          message: "This plot has an active booking and cannot be deleted",
        });
      }

      colony.layout.plots = colony.layout.plots.filter(
        (p) => String(p._id) !== String(plot._id),
      );
      await colony.save();

      res.json(colony.layout);
    } catch (error) {
      console.log(error);
      res.status(500).send("Server Error");
    }
  },
);

module.exports = router;
