const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchUser");
const Booking = require("../models/Booking");
const User = require("../models/User");
const AgentRating = require("../models/Rating");
const updateAgentRating = require("../utils/updateAgentRating");
const { notifyAdmins, notifyUser } = require("../utils/notify");

router.get("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let query = {};

    //----------------------------------
    // ADMIN / STAFF
    //----------------------------------

    if (user.role === "admin" || user.role === "staff") {
      query = {};
    }

    //----------------------------------
    // AGENT
    //----------------------------------
    else if (user.role === "agent") {
      query.agent = user._id;
    }

    //----------------------------------
    // CUSTOMER
    //----------------------------------
    else {
      query.customer = user._id;
    }

    const ratings = await AgentRating.find(query)
      .populate("agent", "name phone referralId designation averageRating")
      .populate("customer", "name phone")
      .populate("booking")
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      msg: "Server Error",
    });
  }
});

router.get("/star/:star", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    const ratings = await AgentRating.find({
      stars: Number(req.params.star),
    })
      .populate("agent", "name phone designation")
      .populate("customer", "name");

    res.json(ratings);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.post("/submit", fetchuser, async (req, res) => {
  try {
    const { bookingId, stars, review } = req.body;
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        msg: "Booking not found",
      });
    }

    //--------------------------------

    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    //--------------------------------

    if (booking.amountPaid < booking.finalAmount) {
      return res.status(400).json({
        msg: "Booking payment not completed",
      });
    }

    //--------------------------------

    const already = await AgentRating.findOne({
      booking: bookingId,
    });
    if (already) {
      return res.status(400).json({
        msg: "Already Rated",
      });
    }

    //--------------------------------

    const rating = await AgentRating.create({
      booking: booking._id,
      customer: booking.customer,
      agent: booking.agent,
      stars,
      review,
    });
    await notifyAdmins({
      sender: booking.customer,
      title: "Agent Rated",
      message: "A customer submitted an agent rating.",
      type: "rating",
      referenceId: rating._id,
      referenceModel: "Rating",
    });

    await notifyUser({
      user: booking.agent,
      sender: booking.customer,
      title: "You Received a Rating",
      message: `You received a ${stars}-star rating from a customer.`,
      type: "rating",
      referenceId: rating._id,
      referenceModel: "Rating",
    });

    //--------------------------------

    const agent = await User.findById(booking.agent);
    await updateAgentRating(agent._id);
    await updateAgentRating(booking.agent);
    res.json(rating);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

router.get("/agent/:id", fetchuser, async (req, res) => {
  try {
    const ratings = await AgentRating.find({
      agent: req.params.id,
    })
      .populate("customer", "name phone")
      .populate("booking")
      .sort({
        createdAt: -1,
      });

    res.json(ratings);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.get("/can-rate/:bookingId", fetchuser, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res.json({
        canRate: false,
      });
    }

    const exists = await AgentRating.findOne({
      booking: booking._id,
    });

    res.json({
      canRate: booking.amountPaid >= booking.finalAmount && !exists,
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.get("/leaderboard", async (req, res) => {
  const agents = await User.find({
    role: "agent",
  })
    .select(
      `
      name
      phone
      designation
      ratingPoints
      averageRating
      totalRatings
      badge
      `,
    )
    .sort({
      ratingPoints: -1,
    })
    .limit(20);

  res.json(agents);
});

router.get("/summary", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    const agents = await User.find({
      role: "agent",
    }).select(`
        name
        phone
        referralId
        designation
        badge
        overallRating
        customerRating
        leadPoints
        siteVisitPoints
        bookingPoints
      `);

    const data = agents.map((agent) => ({
      ...agent.toObject(),

      leadRating: Math.min(5, agent.leadPoints / 20),

      siteVisitRating: Math.min(5, agent.siteVisitPoints / 20),

      bookingRating: Math.min(5, agent.bookingPoints / 20),
    }));

    res.json(data);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

module.exports = router;
