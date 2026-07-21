const rankSlabs = require("../utils/rankSlabs");
const User = require("../models/User");

const updateRank = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) return;
    if (user.rankType === "manual") {
      return;
    }

    // ADMIN NEVER CHANGES
    if (user.role === "admin") {
      if (
        user.level !== 16 ||
        user.designation !== "Executive Director" ||
        user.directIncomePercent !== 20
      ) {
        user.level = 16;
        user.designation = "Executive Director";
        user.directIncomePercent = 20;

        await user.save();
      }

      return;
    }

    const totalBusiness =
      Number(user.selfBusiness || 0) +
      Number(user.leftBusiness || 0) +
      Number(user.rightBusiness || 0);

    const rank = [...rankSlabs]
      .sort((a, b) => b.min - a.min)
      .find((r) => totalBusiness >= r.min);

    if (!rank) return;

    const changed =
      user.level !== rank.level ||
      user.designation !== rank.designation ||
      user.directIncomePercent !== rank.directIncome;

    user.totalBusiness = totalBusiness;

    if (changed) {
      user.level = rank.level;
      user.designation = rank.designation;
      user.directIncomePercent = rank.directIncome;

      console.log(`${user.name} promoted to ${rank.designation}`);
    }

    await user.save();
  } catch (error) {
    console.log(error);
  }
};

module.exports = updateRank;
