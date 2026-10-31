const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Booking = require("../models/Booking");
const Colony = require("../models/Colony");
const Payment = require("../models/Payment");
const PlotHold = require("../models/PlotHold");
const Payout = require("../models/Payout"); // adjust name/path if different
const User = require("../models/User");
const TransferHistory = require("../models/TransferHistory");
const fetchuser = require("../middleware/fetchUser");
const { notifyUser } = require("../utils/notify");
const updateAgentRating = require("../utils/updateAgentRating");
const releasePlot = require("../utils/releasePlot");
const {
  rebuildSchedule,
  calcAmounts,
} = require("../utils/syncBookingsWithPlots");

const MOVABLE = ["approval", "pending"]; // confirmed bookings are settled
const LIVE = ["approval", "pending", "confirmed"];
const PLC_MIN = 5;
const PLC_MAX = 10;
const BOOKING_POINTS = 15; // same value as POST /booking/add

/* ---------------- helpers ---------------- */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) =>
  Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const day = (d) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const needId = (id, label) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new HttpError(400, `Invalid ${label}`);
};
const needNote = (note) => {
  const t = String(note || "").trim();
  if (t.length < 3) throw new HttpError(400, "A note / reason is required");
  return t;
};

const adminOrStaff = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("role");
    if (!user || !["admin", "staff"].includes(user.role))
      return res
        .status(403)
        .json({ message: "Only admin or staff can transfer" });
    next();
  } catch (e) {
    res.status(500).send("Server Error");
  }
};

const notifyBooking = (user, sender, title, message, booking) =>
  user
    ? notifyUser({
        user,
        sender,
        title,
        message,
        type: "booking",
        referenceId: booking._id,
        referenceModel: "Booking",
      })
    : null;

const plotLabel = async (colonyId, plotId) => {
  const c = await Colony.findById(colonyId)
    .select("name layout.plots._id layout.plots.plotNumber")
    .lean();
  const p = (c?.layout?.plots || []).find(
    (x) => String(x._id) === String(plotId),
  );
  return { colonyName: c?.name, plotNumber: p?.plotNumber };
};

// snapshot of "who / where" for one booking, stored in the history
const party = async (booking) => {
  const [customer, agent, label] = await Promise.all([
    User.findById(booking.customer).select("name").lean(),
    booking.agent
      ? User.findById(booking.agent).select("name referralId").lean()
      : null,
    plotLabel(booking.colony, booking.plot),
  ]);
  return {
    booking: booking._id,
    customer: booking.customer,
    customerName: customer?.name,
    agent: booking.agent,
    agentName: agent?.name,
    agentReferralId: agent?.referralId,
    plot: booking.plot,
    plotNumber: label.plotNumber,
    colonyName: label.colonyName,
  };
};

// Tree = everything under one top-level leader (an agent whose parent is the admin).
const loadTree = async (session = null) => {
  const users = await User.find({ role: { $in: ["agent", "admin"] } })
    .select("parent role name referralId status")
    .session(session)
    .lean();
  const map = new Map(users.map((u) => [String(u._id), u]));

  const rootOf = (id) => {
    let node = map.get(String(id));
    const seen = new Set();
    while (node && !seen.has(String(node._id))) {
      seen.add(String(node._id));
      const parent = node.parent && map.get(String(node.parent));
      if (!parent || parent.role === "admin") return String(node._id);
      node = parent;
    }
    return null;
  };
  return { map, rootOf };
};

// runs a handler inside one transaction; the handler returns
// { response, after } where `after` (notifications etc.) runs after commit
const run = (handler) => async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await handler(req, session);
    });
    try {
      await out.after?.();
    } catch (e) {
      console.log("post-transfer tasks failed", e);
    }
    res.json(out.response);
  } catch (err) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ message: err.message });
    console.log(err);
    res.status(500).json({ message: "Transfer failed" });
  } finally {
    session.endSession();
  }
};

/* =====================================================
   1) PLOT TRANSFER  (same colony, target must be FOR_SALE)
   body: { bookingId, newPlotId, note, plcPercent?, requestAmount? }
===================================================== */
router.post(
  "/plot",
  fetchuser,
  adminOrStaff,
  run(async (req, session) => {
    const { bookingId, newPlotId, note, plcPercent, requestAmount } = req.body;
    needId(bookingId, "booking");
    needId(newPlotId, "plot");
    const reason = needNote(note);

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new HttpError(404, "Booking not found");
    if (!MOVABLE.includes(booking.status))
      throw new HttpError(
        400,
        "Only pending bookings can be moved to another plot",
      );
    if (String(booking.plot) === String(newPlotId))
      throw new HttpError(400, "The booking is already on this plot");

    const colony = await Colony.findById(booking.colony)
      .session(session)
      .lean();
    const plots = colony?.layout?.plots || [];
    const oldPlot = plots.find((p) => String(p._id) === String(booking.plot));
    const newPlot = plots.find((p) => String(p._id) === String(newPlotId));

    if (!newPlot)
      throw new HttpError(400, "The new plot must be in the same colony");
    if (newPlot.plotType !== "FOR_SALE")
      throw new HttpError(400, "Only plots that are for sale can be selected");

    const hold = await PlotHold.findOne({
      colony: booking.colony,
      plotId: newPlot._id,
      status: "ACTIVE",
    })
      .select("_id")
      .session(session)
      .lean();
    const taken = await Booking.findOne({
      colony: booking.colony,
      plot: newPlot._id,
      status: { $in: LIVE },
    })
      .select("_id")
      .session(session)
      .lean();
    if (hold || taken)
      throw new HttpError(400, "That plot is held or already booked");

    // agreed rate is kept unless a new one is sent
    if (
      requestAmount !== undefined &&
      requestAmount !== null &&
      requestAmount !== ""
    ) {
      const rate = Number(requestAmount);
      if (!(rate > 0)) throw new HttpError(400, "Invalid rate");
      booking.requestAmount = rate;
    }

    // PLC follows the new plot
    if (newPlot.plc) {
      const pct =
        plcPercent !== undefined && plcPercent !== ""
          ? Number(plcPercent)
          : Number(booking.plcPercent) || 0;
      if (!(pct >= PLC_MIN && pct <= PLC_MAX))
        throw new HttpError(
          400,
          `PLC percentage (${PLC_MIN}-${PLC_MAX}) is required for this plot`,
        );
      booking.plcPercent = pct;
    } else {
      booking.plcPercent = 0;
    }

    const from = await party(booking); // "before" snapshot
    const before = booking.finalAmount || 0;
    const next = calcAmounts(booking, newPlot);

    if (next.finalAmount < (booking.amountPaid || 0) - 0.005)
      throw new HttpError(
        400,
        `Already paid ₹${inr(booking.amountPaid)} is more than the new plot total ₹${inr(next.finalAmount)}`,
      );

    // 1) take the new plot (only if it is still FOR_SALE)
    const keepType = ["PENDING", "SOLD"].includes(oldPlot?.plotType)
      ? oldPlot.plotType
      : "PENDING";
    const taken1 = await Colony.updateOne(
      { _id: colony._id },
      { $set: { "layout.plots.$[n].plotType": keepType } },
      {
        session,
        arrayFilters: [{ "n._id": newPlot._id, "n.plotType": "FOR_SALE" }],
      },
    );
    if ((taken1.modifiedCount ?? taken1.nModified) !== 1)
      throw new HttpError(409, "That plot was just taken, pick another one");

    // 2) free the old plot
    if (oldPlot) {
      await Colony.updateOne(
        { _id: colony._id },
        { $set: { "layout.plots.$[o].plotType": "FOR_SALE" } },
        { session, arrayFilters: [{ "o._id": oldPlot._id }] },
      );
    }

    // 3) move the booking
    booking.set(next);
    booking.plot = newPlot._id;
    rebuildSchedule(booking);
    booking.markModified("paymentSchedule");
    booking.notes.push({
      text: `Plot transferred from ${from.plotNumber || "-"} to ${newPlot.plotNumber}. Total ₹${inr(before)} → ₹${inr(next.finalAmount)}. Reason: ${reason}`,
      by: req.user.id,
    });
    await booking.save({ session });

    const to = { ...from, plot: newPlot._id, plotNumber: newPlot.plotNumber };
    const [history] = await TransferHistory.create(
      [
        {
          type: "plot",
          booking: booking._id,
          colony: booking.colony,
          from,
          to,
          amountBefore: before,
          amountAfter: next.finalAmount,
          note: reason,
          transferredBy: req.user.id,
        },
      ],
      { session },
    );

    return {
      response: {
        message: `Moved to plot ${newPlot.plotNumber}`,
        booking,
        history,
      },
      after: async () => {
        const msg = `Plot changed from ${from.plotNumber} to ${newPlot.plotNumber}.`;
        await notifyBooking(
          booking.agent,
          req.user.id,
          "Plot Transferred",
          msg,
          booking,
        );
        await notifyBooking(
          booking.customer,
          req.user.id,
          "Plot Transferred",
          msg,
          booking,
        );
      },
    };
  }),
);

/* =====================================================
   2) PAYMENT TRANSFER  (other customer, or another booking of the same customer)
   body: { sourceBookingId, paymentIds[], targetBookingId, note, sourceAction: "keep" | "release" }
   keep    = the source booking stays as it is
   release = source booking is cancelled (status "rejected") and its plot goes back for sale
             (never hard-deleted, so the history stays readable)
===================================================== */
router.post(
  "/payment",
  fetchuser,
  adminOrStaff,
  run(async (req, session) => {
    const {
      sourceBookingId,
      targetBookingId,
      paymentIds,
      note,
      sourceAction = "keep",
    } = req.body;

    needId(sourceBookingId, "source booking");
    needId(targetBookingId, "target booking");
    const reason = needNote(note);
    if (!["keep", "release"].includes(sourceAction))
      throw new HttpError(400, "sourceAction must be keep or release");
    if (!Array.isArray(paymentIds) || !paymentIds.length)
      throw new HttpError(400, "Select at least one payment");
    if (String(sourceBookingId) === String(targetBookingId))
      throw new HttpError(400, "Choose a different booking");

    const ids = [...new Set(paymentIds.map(String))];
    ids.forEach((id) => needId(id, "payment"));

    const source = await Booking.findById(sourceBookingId).session(session);
    const target = await Booking.findById(targetBookingId).session(session);
    if (!source || !target) throw new HttpError(404, "Booking not found");

    if (!MOVABLE.includes(source.status) || !MOVABLE.includes(target.status))
      throw new HttpError(
        400,
        "Both bookings must be pending (not confirmed or rejected)",
      );

    // business tree stays correct only when the associate is the same
    if (String(source.agent) !== String(target.agent))
      throw new HttpError(
        400,
        "Payments can only move between bookings of the same associate. Transfer the associate first.",
      );

    const payments = await Payment.find({
      _id: { $in: ids },
      booking: source._id,
    }).session(session);
    if (payments.length !== ids.length)
      throw new HttpError(
        400,
        "Some payments do not belong to the source booking",
      );
    if (payments.some((p) => p.status !== "approved"))
      throw new HttpError(400, "Only approved payments can be transferred");

    const moved = round2(payments.reduce((s, p) => s + (p.amount || 0), 0));

    if ((target.amountPaid || 0) + moved > (target.finalAmount || 0) + 0.005)
      throw new HttpError(
        400,
        `The target booking can take at most ₹${inr(Math.max((target.finalAmount || 0) - (target.amountPaid || 0), 0))} more`,
      );

    const remainingOnSource = round2((source.amountPaid || 0) - moved);
    if (sourceAction === "release" && remainingOnSource > 0.005)
      throw new HttpError(
        400,
        "To release the plot, move all payments of the source booking",
      );

    const from = await party(source);
    const to = await party(target);

    // move the payments
    for (const p of payments) {
      p.booking = target._id;
      p.customer = target.customer;
      await p.save({ session });
    }

    source.amountPaid = Math.max(remainingOnSource, 0);
    rebuildSchedule(source);
    source.markModified("paymentSchedule");
    source.notes.push({
      text: `₹${inr(moved)} transferred to ${to.customerName}'s booking (plot ${to.plotNumber}). Reason: ${reason}`,
      by: req.user.id,
    });

    target.amountPaid = round2((target.amountPaid || 0) + moved);
    rebuildSchedule(target);
    target.markModified("paymentSchedule");
    target.notes.push({
      text: `₹${inr(moved)} received from ${from.customerName}'s booking (plot ${from.plotNumber}). Reason: ${reason}`,
      by: req.user.id,
    });

    if (sourceAction === "release") {
      source.status = "rejected";
      source.notes.push({
        text: `Booking cancelled after payment transfer. Plot ${from.plotNumber} is back on sale.`,
        by: req.user.id,
      });
    }

    await source.save({ session });
    await target.save({ session });
    if (sourceAction === "release") await releasePlot(source, session);

    const [history] = await TransferHistory.create(
      [
        {
          type: "payment",
          booking: source._id,
          colony: source.colony,
          from,
          to,
          payments: payments.map((p) => ({
            payment: p._id,
            amount: p.amount,
            paymentType: p.paymentType,
            receiptNo: p.receiptNo,
          })),
          amount: moved,
          sourceAction,
          note: reason,
          transferredBy: req.user.id,
        },
      ],
      { session },
    );

    return {
      response: {
        message: `₹${inr(moved)} transferred`,
        moved,
        source,
        target,
        history,
      },
      after: async () => {
        await notifyBooking(
          source.customer,
          req.user.id,
          "Payment Transferred",
          `₹${inr(moved)} was transferred out of your booking.`,
          source,
        );
        await notifyBooking(
          target.customer,
          req.user.id,
          "Payment Received",
          `₹${inr(moved)} was transferred to your booking.`,
          target,
        );
        await notifyBooking(
          target.agent,
          req.user.id,
          "Payment Transferred",
          `₹${inr(moved)} moved from ${from.customerName} to ${to.customerName}.`,
          target,
        );
      },
    };
  }),
);

/* =====================================================
   3) AGENT TRANSFER  (same tree, before the payout for its payments is released)
   body: { bookingId, newAgentId, note }
===================================================== */
router.post(
  "/agent",
  fetchuser,
  adminOrStaff,
  run(async (req, session) => {
    const { bookingId, newAgentId, note } = req.body;
    needId(bookingId, "booking");
    needId(newAgentId, "associate");
    const reason = needNote(note);

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new HttpError(404, "Booking not found");
    if (booking.status === "rejected")
      throw new HttpError(400, "A rejected booking cannot be transferred");
    if (!booking.agent)
      throw new HttpError(400, "This booking has no associate");

    const oldAgentId = booking.agent;
    if (String(oldAgentId) === String(newAgentId))
      throw new HttpError(400, "The booking already belongs to this associate");

    const newAgent = await User.findOne({ _id: newAgentId, role: "agent" })
      .select("name referralId status")
      .session(session);
    if (!newAgent) throw new HttpError(404, "Associate not found");
    if (newAgent.status !== "active")
      throw new HttpError(400, "The new associate is not active");

    // same tree
    const { rootOf } = await loadTree(session);
    const oldRoot = rootOf(oldAgentId);
    if (!oldRoot || oldRoot !== rootOf(newAgentId))
      throw new HttpError(
        400,
        "The new associate must be in the same tree as the current associate",
      );

    // payout lock: commission of these payments must not be in a released/paid payout yet
    const payments = await Payment.find({
      booking: booking._id,
      status: "approved",
    })
      .select("amount paymentDate createdAt")
      .session(session)
      .lean();
    const payouts = await Payout.find({
      user: oldAgentId,
      status: { $in: ["released", "paid"] },
    })
      .select("cycleStart cycleEnd")
      .session(session)
      .lean();

    for (const pay of payments) {
      const d = day(pay.paymentDate || pay.createdAt);
      const hit = payouts.find(
        (po) => day(po.cycleStart) <= d && d <= day(po.cycleEnd),
      );
      if (hit)
        throw new HttpError(
          400,
          `The ₹${inr(pay.amount)} payment of ${d} is already in the payout cycle ${day(hit.cycleStart)} to ${day(hit.cycleEnd)}. The associate can no longer be changed.`,
        );
    }

    const from = await party(booking);
    const to = {
      ...from,
      agent: newAgent._id,
      agentName: newAgent.name,
      agentReferralId: newAgent.referralId,
    };

    booking.agent = newAgent._id;
    booking.notes.push({
      text: `Associate changed from ${from.agentName} (${from.agentReferralId}) to ${newAgent.name} (${newAgent.referralId}). Reason: ${reason}`,
      by: req.user.id,
    });
    await booking.save({ session });

    // future and existing payments now belong to the new associate
    await Payment.updateMany(
      { booking: booking._id },
      { $set: { agent: newAgent._id } },
      { session },
    );

    // booking points follow the booking
    await User.updateOne(
      { _id: oldAgentId },
      { $inc: { bookingPoints: -BOOKING_POINTS } },
      { session },
    );
    await User.updateOne(
      { _id: newAgent._id },
      { $inc: { bookingPoints: BOOKING_POINTS } },
      { session },
    );

    const incomeNeedsReview = payments.length > 0;
    const [history] = await TransferHistory.create(
      [
        {
          type: "agent",
          booking: booking._id,
          colony: booking.colony,
          from,
          to,
          incomeNeedsReview,
          note: reason,
          transferredBy: req.user.id,
        },
      ],
      { session },
    );

    return {
      response: {
        message: `Associate changed to ${newAgent.name}`,
        incomeNeedsReview,
        booking,
        history,
      },
      after: async () => {
        await updateAgentRating(oldAgentId);
        await updateAgentRating(newAgent._id);
        await notifyBooking(
          oldAgentId,
          req.user.id,
          "Booking Transferred",
          `A booking was moved from you to ${newAgent.name}.`,
          booking,
        );
        await notifyBooking(
          newAgent._id,
          req.user.id,
          "Booking Assigned",
          `A booking was transferred to you.`,
          booking,
        );
      },
    };
  }),
);

/* =====================================================
   HISTORY
===================================================== */
router.get(
  "/history/booking/:bookingId",
  fetchuser,
  adminOrStaff,
  async (req, res) => {
    try {
      const id = req.params.bookingId;
      const rows = await TransferHistory.find({
        $or: [{ booking: id }, { "from.booking": id }, { "to.booking": id }],
      })
        .populate("transferredBy", "name role")
        .sort({ createdAt: -1 })
        .lean();
      res.json(rows);
    } catch (e) {
      res.status(500).send("Server Error");
    }
  },
);

// who held this plot before: every plot / payment / agent move that touched it
router.get(
  "/history/plot/:colonyId/:plotId",
  fetchuser,
  adminOrStaff,
  async (req, res) => {
    try {
      const { colonyId, plotId } = req.params;
      const rows = await TransferHistory.find({
        colony: colonyId,
        $or: [{ "from.plot": plotId }, { "to.plot": plotId }],
      })
        .populate("transferredBy", "name role")
        .sort({ createdAt: -1 })
        .lean();
      res.json(rows);
    } catch (e) {
      res.status(500).send("Server Error");
    }
  },
);

/* =====================================================
   OPTIONS FOR THE TRANSFER FORMS
===================================================== */

// FOR_SALE plots of the booking's own colony
router.get(
  "/options/plots/:bookingId",
  fetchuser,
  adminOrStaff,
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId).select(
        "colony plot",
      );
      if (!booking)
        return res.status(404).json({ message: "Booking not found" });

      const colony = await Colony.findById(booking.colony)
        .select("name layout.plots")
        .lean();
      const plots = (colony?.layout?.plots || [])
        .filter(
          (p) =>
            p.plotType === "FOR_SALE" && String(p._id) !== String(booking.plot),
        )
        .map(({ _id, plotNumber, area, price, plc }) => ({
          _id,
          plotNumber,
          area,
          price,
          plc,
        }))
        .sort((a, b) =>
          String(a.plotNumber).localeCompare(String(b.plotNumber), undefined, {
            numeric: true,
          }),
        );
      res.json(plots);
    } catch (e) {
      res.status(500).send("Server Error");
    }
  },
);

// a customer's movable bookings (for "transfer payment to ...")
router.get(
  "/options/bookings/:customerId",
  fetchuser,
  adminOrStaff,
  async (req, res) => {
    try {
      const filter = {
        customer: req.params.customerId,
        status: { $in: MOVABLE },
      };
      if (
        req.query.exclude &&
        mongoose.Types.ObjectId.isValid(req.query.exclude)
      )
        filter._id = { $ne: req.query.exclude };

      const bookings = await Booking.find(filter)
        .select("colony plot finalAmount amountPaid status agent")
        .lean();

      const out = await Promise.all(
        bookings.map(async (b) => ({
          _id: b._id,
          status: b.status,
          agent: b.agent,
          finalAmount: b.finalAmount,
          amountPaid: b.amountPaid,
          canTake: Math.max((b.finalAmount || 0) - (b.amountPaid || 0), 0),
          ...(await plotLabel(b.colony, b.plot)),
        })),
      );
      res.json(out);
    } catch (e) {
      res.status(500).send("Server Error");
    }
  },
);

// associates in the same tree as the booking's current associate
router.get(
  "/options/agents/:bookingId",
  fetchuser,
  adminOrStaff,
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId).select(
        "agent",
      );
      if (!booking?.agent) return res.json([]);

      const { map, rootOf } = await loadTree();
      const root = rootOf(booking.agent);
      const list = [...map.values()]
        .filter(
          (u) =>
            u.role === "agent" &&
            u.status === "active" &&
            String(u._id) !== String(booking.agent) &&
            rootOf(u._id) === root,
        )
        .map(({ _id, name, referralId }) => ({ _id, name, referralId }))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json(list);
    } catch (e) {
      res.status(500).send("Server Error");
    }
  },
);

router.get(
  "/options/payments/:bookingId",
  fetchuser,
  adminOrStaff,
  async (req, res) => {
    try {
      const payments = await Payment.find({
        booking: req.params.bookingId,
        status: "approved",
      })
        .select(
          "amount paymentType paymentMode receiptNo createdAt paymentDate",
        )
        .sort({ createdAt: 1 })
        .lean();
      res.json(payments);
    } catch (e) {
      res.status(500).send("Server Error");
    }
  },
);

module.exports = router;
