const Booking = require("../models/Booking");

// confirmed = fully settled, rejected = dead, so only these are kept in sync
const SYNC_STATUSES = ["approval", "pending"];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) =>
  Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// same 10% / 20% / 70% split used when a booking is created or PLC is applied,
// deducting whatever is already paid (booking first, then agreement, then full)
// original due date of an installment (same chain used when the booking is created)
const dueDateFor = (booking, key) => {
  const s = booking.paymentSchedule || {};
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + (Number(n) || 0));
    return x;
  };
  const bookingDue = addDays(booking.createdAt, s.booking?.dueDays);
  if (key === "booking") return bookingDue;
  const agreementDue = addDays(bookingDue, s.agreement?.dueDays);
  if (key === "agreement") return agreementDue;
  return addDays(agreementDue, s.full?.dueDays);
};

// Keeps each installment's own percent. slot.amount = FULL size of the
// installment (what the report screen shows); slot.paid = whether the
// customer's total payments already cover it.
const rebuildSchedule = (booking) => {
  const total = booking.finalAmount || 0;
  const schedule = booking.paymentSchedule || {};
  const paid = booking.amountPaid || 0;

  const pct = (key, fallback) => Number(schedule[key]?.percent) || fallback;

  const amounts = {
    booking: round2((total * pct("booking", 10)) / 100),
    agreement: round2((total * pct("agreement", 20)) / 100),
  };
  amounts.full = round2(total - amounts.booking - amounts.agreement);

  let cumulative = 0;
  ["booking", "agreement", "full"].forEach((key) => {
    const slot = schedule[key];
    if (!slot) return;

    cumulative += amounts[key];
    const wasPaid = !!slot.paid;
    const isPaid = paid >= cumulative - 0.005; // rounding tolerance

    slot.amount = amounts[key];
    slot.paid = isPaid;
    if (isPaid && !wasPaid) slot.date = new Date(); // newly covered
    if (!isPaid && wasPaid) slot.date = dueDateFor(booking, key); // owes again: restore the due date
  });
};

// New amounts for a booking from the edited plot.
// A negotiated rate (requestAmount) is kept; only the area changes the final amount then.
const calcAmounts = (booking, plot) => {
  const area = Number(plot.area) || 0;
  const price = Number(plot.price) || 0;
  const rate = booking.requestAmount || price;

  const base = round2(rate * area);
  const plcPercent = plot.plc ? Number(booking.plcPercent) || 0 : 0;
  const plcAmount = round2((base * plcPercent) / 100);

  return {
    plotArea: area,
    pricePerSqft: price,
    totalAmount: round2(price * area),
    plcPercent,
    plcAmount,
    finalAmount: round2(base + plcAmount),
  };
};

const describeChange = (before, after) => {
  const parts = [];
  if (Number(before.area) !== Number(after.area))
    parts.push(`area ${before.area} → ${after.area} sqft`);
  if (Number(before.price) !== Number(after.price))
    parts.push(`list rate ₹${inr(before.price)} → ₹${inr(after.price)}/sqft`);
  if (before.plc && !after.plc) parts.push("PLC removed from plot");
  if (!before.plc && after.plc) parts.push("PLC enabled on plot");
  return parts.join(", ");
};

/**
 * changes: [{ before, after }]  (plain plot objects, before and after the edit)
 */
const syncBookingsWithPlots = async (colonyId, changes, userId) => {
  for (const { before, after } of changes) {
    const bookings = await Booking.find({
      colony: colonyId,
      plot: after._id,
      status: { $in: SYNC_STATUSES },
    });

    const what = describeChange(before, after);

    for (const booking of bookings) {
      const oldFinal = booking.finalAmount || 0;
      const next = calcAmounts(booking, after);

      // the customer has already paid more than the new total: don't touch, flag it
      if (next.finalAmount < (booking.amountPaid || 0)) {
        booking.notes.push({
          text: `Plot edited (${what}) but this booking was NOT updated: paid ₹${inr(booking.amountPaid)} is more than the new total ₹${inr(next.finalAmount)}. Please review manually.`,
          by: userId,
        });
        await booking.save();
        continue;
      }

      booking.set(next);
      rebuildSchedule(booking);
      booking.markModified("paymentSchedule");

      booking.notes.push({
        text:
          next.finalAmount === oldFinal
            ? `Plot edited (${what}). Booking amount unchanged.`
            : `Plot edited (${what}). Total ₹${inr(oldFinal)} → ₹${inr(next.finalAmount)}.`,
        by: userId,
      });

      await booking.save();
    }
  }
};

module.exports = syncBookingsWithPlots;
module.exports.rebuildSchedule = rebuildSchedule;
module.exports.calcAmounts = calcAmounts;
