const Reward = require("../models/Reward");
const UserReward = require("../models/UserReward");
const User = require("../models/User");

const checkRewards = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) return;

    const rewards = await Reward.find().sort({
      targetBusiness: 1,
    });

    if (!user.claimedRewardLevels) {
      user.claimedRewardLevels = [];
    }

    for (const reward of rewards) {
      const alreadyClaimed =
        user.claimedRewardLevels.includes(reward.level);

      if (alreadyClaimed) continue;

      if (
        user.rewardBusinessAchieved >= reward.targetBusiness
      ) {
        const exists = await UserReward.findOne({
          user: user._id,
          reward: reward._id,
        });

        if (exists) continue;

        await UserReward.create({
          user: user._id,
          reward: reward._id,
          achievedBusiness: user.rewardBusinessAchieved,
          status: "unclaimed",
        });

        user.claimedRewardLevels.push(reward.level);
      }
    }

    await user.save();
  } catch (error) {
    console.log(error);
  }
};

module.exports = checkRewards;