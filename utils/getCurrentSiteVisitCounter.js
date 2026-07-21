const SiteVisit = require("../models/SiteVisit");
const Booking = require("../models/Booking");

async function getCurrentSiteVisitCounter(agentId) {
  const lastBooking = await Booking.findOne({
    agent: agentId,
  }).sort({ createdAt: -1 });
  const query = {
    agent: agentId,
  };
  if (lastBooking) {
    query.createdAt = {
      $gt: lastBooking.createdAt,
    };
  }
  const count = await SiteVisit.countDocuments(query);
  return count;
}

module.exports = getCurrentSiteVisitCounter;
