const Booking = require("../models/Booking");
const Colony = require("../models/Colony");

const LIVE = ["approval", "pending", "confirmed"];

// Puts the plot back on sale unless another live booking holds it.
// Only PENDING / SOLD plots are touched (never a HOLD or NOT_FOR_SALE plot).
const releasePlot = async (booking, session = null) => {
  const other = await Booking.findOne({
    _id: { $ne: booking._id },
    colony: booking.colony,
    plot: booking.plot,
    status: { $in: LIVE },
  })
    .select("_id")
    .session(session)
    .lean();
  if (other) return false;

  await Colony.updateOne(
    { _id: booking.colony },
    { $set: { "layout.plots.$[p].plotType": "FOR_SALE" } },
    {
      session,
      arrayFilters: [
        { "p._id": booking.plot, "p.plotType": { $in: ["PENDING", "SOLD"] } },
      ],
    },
  );
  return true;
};

module.exports = releasePlot;