const User = require("../models/User");
const updateRank = require("./updateRank");

const updateBusinessTree = async (agentId, amount) => {
  try {
    amount = Number(amount);

    const agent = await User.findById(agentId);

    if (!agent) return;

    // ==================================
    // SELF BUSINESS
    // ==================================

    agent.selfBusiness += amount;

    agent.totalBusiness =
      agent.selfBusiness + agent.leftBusiness + agent.rightBusiness;

    await agent.save();

    // UPDATE RANK
    await updateRank(agent._id);

    // ==================================
    // UPLINE BUSINESS
    // ==================================

    let currentUser = agent;

    while (currentUser.parent) {
      const parent = await User.findById(currentUser.parent);
      console.log("CHILD:", currentUser.name);
      console.log("POSITION:", currentUser.position);
      console.log("AMOUNT:", amount);

      if (!parent) break;

      if (currentUser.position === "left") {
        parent.leftBusiness += amount;
      } else {
        parent.rightBusiness += amount;
      }

      parent.totalBusiness =
        parent.selfBusiness + parent.leftBusiness + parent.rightBusiness;

      await parent.save();

      // UPDATE PARENT RANK
      await updateRank(parent._id);

      currentUser = parent;
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = updateBusinessTree;
