const express = require("express");
const router = express.Router();

const SiteVisit = require("../models/SiteVisit");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchuser");

router.get("/", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    let query = {};

    // Admin / Staff → ALL
    if (loggedUser.role === "admin" || loggedUser.role === "staff") {
      query = {};
    }

    // Agent → only own
    else if (loggedUser.role === "agent") {
      query = { agent: loggedUser._id };
    }

    const visits = await SiteVisit.find(query)
      .populate("customer", "name phone")
      .populate("agent", "name phone")
      .populate("location", "name")
      .populate("colony", "name");

    res.json(visits);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.post("/add", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    let data = {
      customer: req.body.customer,
      location: req.body.location,
      colony: req.body.colony,
      visitDate: req.body.visitDate,
      createdBy: loggedUser._id,
    };

    // 🔥 Admin / Staff
    if (loggedUser.role === "admin" || loggedUser.role === "staff") {
      data.agent = req.body.agent;
      data.status = "scheduled";
    }

    // 🔥 Agent
    else if (loggedUser.role === "agent") {
      data.agent = loggedUser._id;
      data.status = "approval";
    }

    const visit = await SiteVisit.create(data);

    res.json(visit);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/action/:id", fetchuser, async (req, res) => {
  try {

    const loggedUser = await User.findById(req.user.id);

    if (loggedUser.role !== "admin" && loggedUser.role !== "staff") {
      return res.status(403).json({
        message: "Only admin or staff can take action"
      });
    }

    const { action, visitDate, note } = req.body;

    let update = {};

    // 🔥 APPROVE
    if (action === "approve") {
      update.status = "scheduled";
    }

    // 🔥 REJECT (NOTE REQUIRED)
    else if (action === "reject") {

      if (!note) {
        return res.status(400).json({
          message: "Note is required when rejecting"
        });
      }

      update.status = "rejected";
    }

    // 🔥 RESCHEDULE (NOTE + DATE REQUIRED)
    else if (action === "reschedule") {

      if (!visitDate) {
        return res.status(400).json({
          message: "visitDate is required"
        });
      }

      if (!note) {
        return res.status(400).json({
          message: "Note is required when rescheduling"
        });
      }

      update.status = "rescheduled";
      update.visitDate = visitDate;
    }

    else {
      return res.status(400).json({
        message: "Invalid action"
      });
    }

    // 🔥 PUSH NOTE IF EXISTS
    if (note) {
      update.$push = {
        notes: {
          text: note,
          by: loggedUser._id,
          date: new Date()
        }
      };
    }

    const visit = await SiteVisit.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).populate("notes.by", "name");

    res.json(visit);

  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.post("/add-note/:id", fetchuser, async (req, res) => {
  try {

    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        message: "Note is required"
      });
    }

    const visit = await SiteVisit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        message: "Site visit not found"
      });
    }

    // 🔥 Only allow if status is approval or scheduled
    if (!["approval", "scheduled"].includes(visit.status)) {
      return res.status(400).json({
        message: "Notes allowed only in approval or scheduled status"
      });
    }

    visit.notes.push({
      text: note,
      by: req.user.id,
      date: new Date()
    });

    await visit.save();

    const updated = await SiteVisit.findById(req.params.id)
      .populate("notes.by", "name");

    res.json(updated);

  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/complete/:id", fetchuser, async (req, res) => {
  try {
    const visit = await SiteVisit.findByIdAndUpdate(
      req.params.id,
      { status: "completed" },
      { new: true },
    );

    res.json(visit);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    await SiteVisit.findByIdAndDelete(req.params.id);

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;