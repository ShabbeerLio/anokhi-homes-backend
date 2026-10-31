const express = require("express");
const router = express.Router();
const Colony = require("../models/Colony");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");
const getDownlineIds = require("../utils/getDownlineIds");

// a rejected booking frees the plot, so it doesn't count as "booked"
const ACTIVE_BOOKING_STATUSES = ["approval", "pending", "confirmed"];

// GET ALL COLONIES
router.get("/", async (req, res) => {
  try {
    const colonies = await Colony.find().populate("locationId");

    res.json(colonies);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

// GET COLONIES BY LOCATION
router.get("/location/:locationId", async (req, res) => {
  try {
    const colonies = await Colony.find({
      locationId: req.params.locationId,
    });

    res.json(colonies);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

// ADD COLONY
router.post("/add", async (req, res) => {
  try {
    const colony = await Colony.create(req.body);

    res.json(colony);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

// EDIT COLONY
router.put("/edit/:id", async (req, res) => {
  try {
    const colony = await Colony.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json(colony);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

// DELETE COLONY
router.delete("/delete/:id", async (req, res) => {
  try {
    await Colony.findByIdAndDelete(req.params.id);

    res.json({ message: "Colony deleted" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.get("/:colonyId/plots", fetchuser, async (req, res) => {
  try {
    const { colonyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(colonyId)) {
      return res.status(400).json({ message: "Invalid colony id" });
    }

    const user = await User.findById(req.user.id).select("role");
    if (!user) return res.status(404).json({ message: "User not found" });

    const withPoints = req.query.points === "true";

    const colony = await Colony.findById(colonyId)
      .select(
        withPoints
          ? "-layout.mainPlot"
          : "-layout.mainPlot -layout.plots.points",
      )
      .lean();

    if (!colony) return res.status(404).json({ message: "Colony not found" });

    // active bookings of this colony, newest first
    const bookings = await Booking.find({
      colony: colonyId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
    })
      .select(
        "plot customer agent status finalAmount amountPaid requestAmount pricePerSqft plotArea plcPercent plcAmount createdAt",
      )
      .populate("customer", "name phone")
      .populate("agent", "name phone referralId")
      .sort({ createdAt: -1 })
      .lean();

    // who may see the booking details (same rules as the bookings list)
    let allowedAgentIds = null;
    if (user.role === "agent") {
      const downline = await getDownlineIds(user._id);
      allowedAgentIds = new Set([user._id, ...downline].map(String));
    }

    const canSee = (b) => {
      if (user.role === "admin" || user.role === "staff") return true;
      if (user.role === "agent")
        return allowedAgentIds.has(String(b.agent?._id));
      return String(b.customer?._id) === String(user._id); // customer: own booking only
    };

    // one booking per plot (newest wins)
    const bookingByPlot = new Map();
    bookings.forEach((b) => {
      const key = String(b.plot);
      if (!bookingByPlot.has(key)) bookingByPlot.set(key, b);
    });

    const plots = (colony.layout?.plots || []).map((p) => {
      const b = bookingByPlot.get(String(p._id));
      const total = b?.finalAmount || 0;
      const paid = b?.amountPaid || 0;

      return {
        ...p,
        isBooked: !!b,
        booking:
          b && canSee(b)
            ? {
                _id: b._id,
                status: b.status,
                bookedOn: b.createdAt,
                customer: b.customer
                  ? {
                      _id: b.customer._id,
                      name: b.customer.name,
                      phone: b.customer.phone,
                    }
                  : null,
                agent: b.agent
                  ? {
                      _id: b.agent._id,
                      name: b.agent.name,
                      phone: b.agent.phone,
                      referralId: b.agent.referralId,
                    }
                  : null,
                plotArea: b.plotArea,
                ratePerSqft: b.requestAmount || b.pricePerSqft,
                plcPercent: b.plcPercent || 0,
                plcAmount: b.plcAmount || 0,
                totalAmount: total,
                amountPaid: paid,
                remaining: Math.max(total - paid, 0),
              }
            : null,
      };
    });

    res.json({
      colony: {
        _id: colony._id,
        name: colony.name,
        category: colony.category,
        locationId: colony.locationId,
      },
      total: plots.length,
      booked: plots.filter((p) => p.isBooked).length,
      plots,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
