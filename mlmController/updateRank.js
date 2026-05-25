const rankSlabs = require("../utils/rankSlabs");
const User = require("../models/User");

const updateRank = async (userId) => {

  const user = await User.findById(userId);

  if (!user) return;

  // TOTAL BUSINESS
  const totalBusiness =
    user.selfBusiness +
    user.leftBusiness +
    user.rightBusiness;

  // FIND MATCHING RANK
  const rank = rankSlabs.find(
    (r) =>
      totalBusiness >= r.min &&
      totalBusiness < r.max
  );

  if (!rank) return;

  // UPDATE USER
  user.level = rank.level;

  user.designation =
    rank.designation;

  user.directIncomePercent =
    rank.directIncome;

  user.totalBusiness =
    totalBusiness;

  await user.save();
};

module.exports = updateRank;