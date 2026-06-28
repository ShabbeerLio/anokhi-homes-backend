const express = require("express");
const router = express.Router();

const SiteVisit = require("../models/SiteVisit");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");
const Lead = require("../models/Lead");
const updateAgentRating = require("../utils/updateAgentRating");
const { notifyUser, notifyAdmins } = require("../utils/notify");

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
    // user → only own
    else if (loggedUser.role === "user") {
      query = { customer: loggedUser._id };
    }

    const visits = await SiteVisit.find(query)
      .populate("customer", "name phone")
      .populate("agent", "name phone")
      .populate("location", "name")
      .populate("colonies.colony", "name")
      .populate("notes.by", "name role");

    res.json(visits);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.post("/add", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    let data = {
      lead: req.body.lead,
      customer: req.body.customer,
      location: req.body.location,
      colonies: req.body.colonies.map((id) => ({
        colony: id,
        status: "pending",
      })),
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
    const agent = await User.findById(visit.agent);
    if (loggedUser.role === "agent") {
      await notifyAdmins({
        sender: loggedUser._id,
        title: "New Site Visit Request",
        message: `${loggedUser.name} requested a site visit for ${req.body.visitDate}.`,
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });

      await notifyUser({
        user: visit.customer,
        sender: loggedUser._id,
        title: "Site Visit Requested",
        message: "Your associate has requested a site visit.",
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });
    } else {
      await notifyUser({
        user: visit.agent,
        sender: loggedUser._id,
        title: "New Site Visit Assigned",
        message: "A new site visit has been assigned to you.",
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });

      await notifyUser({
        user: visit.customer,
        sender: loggedUser._id,
        title: "Site Visit Scheduled",
        message: "Your site visit has been scheduled successfully.",
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });
    }

    if (agent) {
      agent.siteVisitPoints += 5;
      await agent.save();
      await updateAgentRating(agent._id);
    }
    // ✅ UPDATE LEAD STATUS

    await Lead.findByIdAndUpdate(req.body.lead, {
      status: "converted",
      convertedAt: new Date(),
      $push: {
        notes: {
          text: "Lead converted via site visit",
          by: loggedUser._id,
        },
      },
    });
    await notifyAdmins({
      sender: loggedUser._id,
      title: "Lead Converted",
      message: `${loggedUser.name} has converted lead into a Site Visit.`,
      type: "lead",
      referenceId: req.body.lead,
      referenceModel: "Lead",
    });

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
        message: "Only admin or staff can take action",
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
          message: "Note is required when rejecting",
        });
      }

      update.status = "rejected";
    }

    // 🔥 RESCHEDULE (NOTE + DATE REQUIRED)
    else if (action === "reschedule") {
      if (!visitDate) {
        return res.status(400).json({
          message: "visitDate is required",
        });
      }

      if (!note) {
        return res.status(400).json({
          message: "Note is required when rescheduling",
        });
      }

      update.status = "rescheduled";
      update.visitDate = visitDate;
    } else {
      return res.status(400).json({
        message: "Invalid action",
      });
    }

    // 🔥 PUSH NOTE IF EXISTS
    if (note) {
      update.$push = {
        notes: {
          text: note,
          by: loggedUser._id,
          date: new Date(),
        },
      };
    }

    const visit = await SiteVisit.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).populate("notes.by", "name");

    if (action === "approve") {
      await notifyUser({
        user: visit.agent,
        sender: loggedUser._id,
        title: "Site Visit Approved",
        message: "Your site visit request has been approved.",
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });

      await notifyUser({
        user: visit.customer,
        sender: loggedUser._id,
        title: "Site Visit Approved",
        message: "Your site visit has been approved.",
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });
    } else if (action === "reject") {
      await notifyUser({
        user: visit.agent,
        sender: loggedUser._id,
        title: "Site Visit Rejected",
        message: "Your site visit request has been rejected.",
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });

      await notifyUser({
        user: visit.customer,
        sender: loggedUser._id,
        title: "Site Visit Cancelled",
        message: "Your site visit request has been cancelled.",
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });
    } else if (action === "reschedule") {
      await notifyUser({
        user: visit.agent,
        sender: loggedUser._id,
        title: "Site Visit Rescheduled",
        message: `Your site visit has been rescheduled to ${visit.visitDate}.`,
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });

      await notifyUser({
        user: visit.customer,
        sender: loggedUser._id,
        title: "Site Visit Rescheduled",
        message: `Your site visit has been rescheduled to ${visit.visitDate}.`,
        type: "sitevisit",
        referenceId: visit._id,
        referenceModel: "SiteVisit",
      });
    }

    res.json(visit);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =========================
   ADD NOTE TO LEAD
========================= */

router.post("/add-note/:id", fetchuser, async (req, res) => {
  try {
    const { note, image, colonyId } = req.body;

    // if (!note) {
    //   return res.status(400).json({
    //     message: "Note is required",
    //   });
    // }

    const visit = await SiteVisit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        message: "Site visit not found",
      });
    }

    // 🔥 ROLE CHECK (optional but recommended)
    const loggedUser = await User.findById(req.user.id);

    // Agent can only add note to their own lead
    if (
      loggedUser.role === "agent" &&
      visit.agent?.toString() !== loggedUser._id.toString()
    ) {
      return res.status(403).json({
        message: "Not allowed to add note to this lead",
      });
    }

    // 🔥 ADD NOTE
    visit.notes.push({
      text: note,
      image: image || "",
      colony: colonyId,
      by: loggedUser._id,
    });

    const colony = visit.colonies.find((c) => c.colony.toString() === colonyId);

    if (colony) {
      colony.status = "done";
    }

    await visit.save();
    await visit.populate("notes.by", "name role");
    await notifyAdmins({
      sender: loggedUser._id,
      title: "Site Visit Updated",
      message: `${loggedUser.name} added a site visit note.`,
      type: "sitevisit",
      referenceId: visit._id,
      referenceModel: "SiteVisit",
    });

    res.json({
      message: "Note added successfully",
      visit,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/edit-note/:visitId/:noteId", fetchuser, async (req, res) => {
  try {
    const { note, image } = req.body;

    // if (!note) {
    //   return res.status(400).json({ message: "Note is required" });
    // }

    const visit = await SiteVisit.findById(req.params.visitId);
    if (!visit)
      return res.status(404).json({ message: "Site visit not found" });

    const loggedUser = await User.findById(req.user.id);

    const noteItem = visit.notes.id(req.params.noteId);
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
    if (image !== undefined) {
      noteItem.image = image;
    }
    noteItem.editedAt = new Date();

    await visit.save();
    await visit.populate("notes.by", "name role");

    res.json({ message: "Note updated", visit });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.delete("/delete-note/:visitId/:noteId", fetchuser, async (req, res) => {
  try {
    const visit = await SiteVisit.findById(req.params.visitId);
    if (!visit)
      return res.status(404).json({ message: "Site visit not found" });

    const loggedUser = await User.findById(req.user.id);

    const noteItem = visit.notes.id(req.params.noteId);
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

    await visit.save();

    res.json({ message: "Note deleted", visit });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.put("/complete/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    const visit = await SiteVisit.findByIdAndUpdate(
      req.params.id,
      {
        status: "completed",
      },
      {
        new: true,
      },
    );

    await notifyAdmins({
      sender: loggedUser._id,
      title: "Site Visit Completed",
      message: `${loggedUser.name} completed a site visit.`,
      type: "sitevisit",
      referenceId: visit._id,
      referenceModel: "SiteVisit",
    });

    await notifyUser({
      user: visit.customer,
      sender: loggedUser._id,
      title: "Site Visit Completed",
      message: "Your site visit has been completed successfully.",
      type: "sitevisit",
      referenceId: visit._id,
      referenceModel: "SiteVisit",
    });

    res.json(visit);
  } catch (error) {
    console.log(error);
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
