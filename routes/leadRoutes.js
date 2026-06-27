const express = require("express");
const router = express.Router();

const Lead = require("../models/Lead");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");
const updateAgentRating = require("../utils/updateAgentRating");
const { notifyUser, notifyAdmins, notifyMany } = require("../utils/notify");
/* =========================
   GET ALL LEADS
========================= */

router.get("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let leads = [];

    // ✅ ADMIN / STAFF
    if (user.role === "admin" || user.role === "staff") {
      leads = await Lead.find()
        .populate("agent", "name")
        .populate("notes.by", "name");
    }

    // ✅ AGENT VIEW
    else if (user.role === "agent") {
      const all = await Lead.find({
        $or: [{ agent: user._id }, { rejectedBy: user._id }],
      })
        .populate("agent", "name")
        .populate("notes.by", "name");

      leads = all.map((lead) => {
        let obj = lead.toObject();

        // ✅ 🔥 FINAL STATES FIRST (DO NOT OVERRIDE)
        if (lead.status === "lost") {
          obj.status = "lost";
        } else if (lead.status === "converted") {
          obj.status = "converted";
        }

        // 🔥 NEW (assigned but not accepted)
        else if (lead.agent && !lead.isAccepted && lead.assignedBy) {
          obj.status = "new";
        }

        // 🔥 ACCEPTED
        else if (lead.agent && lead.isAccepted) {
          obj.status = "assigned";
        }

        // 🔥 REJECTED
        else if (lead.rejectedBy?.toString() === user._id.toString()) {
          obj.status = "rejected";
        }

        // 🔥 MISSED
        else if (!lead.agent && lead.status === "unassigned") {
          obj.status = "missed";
        }

        return obj;
      });
    }

    // ✅ USER → ONLY THEIR LEADS
    else if (user.role === "user") {
      leads = await Lead.find({
        customer: user._id, // 🔥 IMPORTANT
      })
        .populate("agent", "name")
        .populate("notes.by", "name role");
    }

    res.json(leads);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   ADD LEAD
========================= */

router.post("/add", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);
    const { customerId } = req.body;

    let leadData = {
      customer: customerId,
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      source: req.body.source,
      notes: req.body.notes || [],
    };

    // If agent creates lead
    if (loggedUser.role === "agent") {
      leadData.agent = loggedUser._id;
      leadData.status = "assigned";
      leadData.isAccepted = true; // ✅ FIX
    } else {
      // Admin / staff
      leadData.status = "new";
    }

    const lead = await Lead.create(leadData);
    const agent = await User.findById(lead.agent);
    if (loggedUser.role === "agent") {
      await notifyAdmins({
        sender: loggedUser._id,
        title: "New Lead Created",
        message: `${loggedUser.name} created a new lead for ${lead.name}.`,
        type: "lead",
        referenceId: lead._id,
        referenceModel: "Lead",
      });
    }
    await notifyUser({
      user: lead.customer,
      sender: loggedUser._id,
      title: "Lead Created",
      message: "Your enquiry has been received successfully.",
      type: "lead",
      referenceId: lead._id,
      referenceModel: "Lead",
    });

    if (agent) {
      agent.leadPoints += 2;
      await agent.save();
      await updateAgentRating(agent._id);
    }

    res.json(lead);
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
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        message: "Note is required",
      });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found",
      });
    }

    // 🔥 ROLE CHECK (optional but recommended)
    const loggedUser = await User.findById(req.user.id);

    // Agent can only add note to their own lead
    if (
      loggedUser.role === "agent" &&
      lead.agent?.toString() !== loggedUser._id.toString()
    ) {
      return res.status(403).json({
        message: "Not allowed to add note to this lead",
      });
    }

    await notifyAdmins({
      sender: loggedUser._id,
      title: "Lead Updated",
      message: `${loggedUser.name} added a note to ${lead.name}.`,
      type: "lead",
      referenceId: lead._id,
      referenceModel: "Lead",
    });
    // 🔥 ADD NOTE
    lead.notes.push({
      text: note,
      by: loggedUser._id,
    });

    await lead.save();
    await lead.populate("notes.by", "name role");

    res.json({
      message: "Note added successfully",
      lead,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});
router.put("/edit-note/:leadId/:noteId", fetchuser, async (req, res) => {
  try {
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ message: "Note is required" });
    }

    const lead = await Lead.findById(req.params.leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const loggedUser = await User.findById(req.user.id);

    const noteItem = lead.notes.id(req.params.noteId);
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

    await lead.save();
    await lead.populate("notes.by", "name role");
    res.json({ message: "Note updated", lead });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.delete("/delete-note/:leadId/:noteId", fetchuser, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const loggedUser = await User.findById(req.user.id);

    const noteItem = lead.notes.id(req.params.noteId);
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

    await lead.save();

    res.json({ message: "Note deleted", lead });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* =========================
   EDIT LEAD
========================= */

router.put("/edit/:id", fetchuser, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json(lead);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   DELETE LEAD
========================= */

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);

    res.json({ message: "Lead deleted" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   ASSIGN AGENT
========================= */

router.put("/assign/:id", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (admin.role !== "admin" && admin.role !== "staff") {
      return res.status(403).json({ message: "Not allowed" });
    }

    const { agentId } = req.body;

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        agent: agentId,
        status: "assigned",
        assignedAt: new Date(),
        assignedBy: admin._id,
        isAccepted: false, // 🔥 important
      },
      { new: true },
    );
    await notifyUser({
      user: agentId,
      sender: admin._id,
      title: "New Lead Assigned",
      message: `${lead.name} has been assigned to you.`,
      type: "lead",
      referenceId: lead._id,
      referenceModel: "Lead",
    });
    await notifyUser({
      user: lead.customer,
      sender: admin._id,
      title: "Associate Assigned",
      message: `${lead.name}, your enquiry has been assigned to an associate.`,
      type: "lead",
      referenceId: lead._id,
      referenceModel: "Lead",
    });
    res.json(lead);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.put("/agent-action/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "agent") {
      return res.status(403).json({ message: "Only agent allowed" });
    }
    const { action, note } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (lead.agent.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Not your lead" });
    }

    let update = {};
    // ✅ ACCEPT
    if (action === "accept") {
      update.isAccepted = true;
      update.$push = {
        notes: {
          text: note || `Accepted by ${user.name}`,
          by: user._id,
        },
      };
      await notifyAdmins({
        sender: user._id,
        title: "Lead Accepted",
        message: `${user.name} accepted lead ${lead.name}.`,
        type: "lead",
        referenceId: lead._id,
        referenceModel: "Lead",
      });
      await notifyUser({
        user: lead.customer,
        sender: user._id,
        title: "Lead Accepted",
        message: "Your associate has accepted your enquiry.",
        type: "lead",
        referenceId: lead._id,
        referenceModel: "Lead",
      });
    }

    // ❌ REJECT
    else if (action === "reject") {
      if (!note) {
        return res.status(400).json({ message: "Note required" });
      }

      update.status = "unassigned"; // 🔥 back to admin
      update.rejectedBy = user._id;
      update.agent = null;
      update.isAccepted = false;

      update.$push = {
        notes: {
          text: note,
          by: user._id,
        },
      };
      await notifyAdmins({
        sender: user._id,
        title: "Lead Rejected",
        message: `${user.name} rejected lead ${lead.name}.`,
        type: "lead",
        referenceId: lead._id,
        referenceModel: "Lead",
      });
      await notifyUser({
        user: lead.customer,
        sender: user._id,
        title: "Lead Update",
        message: "Your enquiry is being reassigned.",
        type: "lead",
        referenceId: lead._id,
        referenceModel: "Lead",
      });
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    const updated = await Lead.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.put("/mark-lost/:id", fetchuser, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        message: "Lost reason is required",
      });
    }

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const user = await User.findById(req.user.id);

    // ✅ Agent can only mark their own lead
    if (
      user.role === "agent" &&
      lead.agent?.toString() !== user._id.toString()
    ) {
      return res.status(403).json({
        message: "Not allowed to update this lead",
      });
    }

    // 🔥 Update lead
    lead.status = "lost";
    lead.lostReason = reason;
    lead.lostAt = new Date();

    // ✅ Add note automatically
    lead.notes.push({
      text: `Marked as lost: ${reason}`,
      by: user._id,
    });
    await notifyAdmins({
      sender: user._id,
      title: "Lead Marked Lost",
      message: `${user.name} marked ${lead.name} as lost.`,
      type: "lead",
      referenceId: lead._id,
      referenceModel: "Lead",
    });
    await notifyUser({
      user: lead.customer,
      sender: user._id,
      title: "Lead Closed",
      message: "Your enquiry has been closed.",
      type: "lead",
      referenceId: lead._id,
      referenceModel: "Lead",
    });

    await lead.save();

    res.json({
      message: "Lead marked as lost",
      lead,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
