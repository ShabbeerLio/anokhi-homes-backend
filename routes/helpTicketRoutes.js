const express = require("express");
const router = express.Router();
const HelpTicket = require("../models/HelpTicket");
const fetchuser = require("../middleware/fetchUser");
const User = require("../models/User");

//
// CREATE TICKET
//
router.post("/create", fetchuser, async (req, res) => {
  try {
    const { type, title, message, attachments } = req.body;
    const user = await User.findById(req.user.id);

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }
    if (type === "Emergency Payout" && user.role !== "agent") {
      return res.status(403).json({
        success: false,

        message: "Emergency Payout tickets are only available for Associates.",
      });
    }

    const ticket = new HelpTicket({
      type,
      title,
      message,
      attachments: attachments || [],
      createdBy: req.user.id,
    });

    await ticket.save();

    const populated = await HelpTicket.findById(ticket._id).populate(
      "createdBy",
      "name email role",
    );

    res.json({
      success: true,
      ticket: populated,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

//
// GET ALL TICKETS
//
router.get("/", fetchuser, async (req, res) => {
  try {
    let query = {};

    // Admin & Staff → all tickets
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      query.createdBy = req.user.id;
    }

    const tickets = await HelpTicket.find(query)
      .populate("createdBy", "name email role")
      .populate("assignedTo", "name role")
      .populate("replies.by", "name role")
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      tickets,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

//
// GET SINGLE TICKET
//
router.get("/:id", fetchuser, async (req, res) => {
  try {
    const ticket = await HelpTicket.findById(req.params.id)
      .populate("createdBy", "name role")
      .populate("assignedTo", "name role")
      .populate("replies.by", "name role");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // User can only view own ticket
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      if (ticket.createdBy._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    res.json({
      success: true,
      ticket,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

//
// ADD REPLY
//
router.put("/reply/:id", fetchuser, async (req, res) => {
  try {
    const { title, message, attachments } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Reply message required",
      });
    }

    const ticket = await HelpTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // User can only reply to own ticket
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      if (ticket.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    ticket.replies.unshift({
      title,
      message,
      attachments: attachments || [],
      by: req.user.id,
      role: req.user.role,
    });

    const loggedUser = await User.findById(req.user.id);

    ticket.replies.unshift({
      title,
      message,
      attachments: attachments || [],
      by: loggedUser._id,
      role: loggedUser.role,
    });

    // Admin/Staff replied
    if (loggedUser.role === "admin" || loggedUser.role === "staff") {
      ticket.status = "Replied";
    }
    // Agent/User replied
    else {
      ticket.status = "Response";
    }

    await ticket.save();

    const updated = await HelpTicket.findById(ticket._id)
      .populate("createdBy", "name role")
      .populate("replies.by", "name role");

    res.json({
      success: true,
      ticket: updated,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

//
// CLOSE TICKET
//
router.put("/close/:id", fetchuser, async (req, res) => {
  try {
    const ticket = await HelpTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (req.user.role !== "admin" && req.user.role !== "staff") {
      if (ticket.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    ticket.status = "Closed";

    await ticket.save();

    res.json({
      success: true,
      message: "Ticket Closed",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

//
// REOPEN TICKET (Optional)
//
router.put("/reopen/:id", fetchuser, async (req, res) => {
  try {
    const ticket = await HelpTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    ticket.status = "Open";

    await ticket.save();

    res.json({
      success: true,
      message: "Ticket Reopened",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

//
// DELETE TICKET (Admin only)
//
router.delete("/:id", fetchuser, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete tickets",
      });
    }

    const ticket = await HelpTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    await ticket.deleteOne();

    res.json({
      success: true,
      message: "Ticket deleted",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

module.exports = router;
