const User = require("../models/User");
const AgentRating = require("../models/Rating");

module.exports = async (agentId) => {
  try {
    const agent = await User.findById(agentId);
    if (!agent) return;
    const ratings = await AgentRating.find({
      agent: agentId,
    });
    const totalStars = ratings.reduce((sum, item) => sum + item.stars, 0);
    const customerRating = ratings.length > 0 ? totalStars / ratings.length : 0;
    const leadRating = Math.min(5, agent.leadPoints / 20);
    const siteVisitRating = Math.min(5, agent.siteVisitPoints / 20);
    const bookingRating = Math.min(5, agent.bookingPoints / 20);
    const overallRating =
      (leadRating + siteVisitRating + bookingRating + customerRating) / 4;
    const totalPerformancePoints =
      agent.leadPoints + agent.siteVisitPoints + agent.bookingPoints;
    let badge = "Starter";
    if (totalPerformancePoints >= 100) badge = "Silver Agent";
    if (totalPerformancePoints >= 300) badge = "Gold Agent";
    if (totalPerformancePoints >= 700) badge = "Diamond Agent";
    if (totalPerformancePoints >= 1500) badge = "Crown Ambassador";

    agent.customerRating = customerRating;
    agent.totalCustomerRatings = ratings.length;
    agent.overallRating = overallRating;
    agent.badge = badge;
    await agent.save();
  } catch (error) {
    console.log(error);
  }
};
