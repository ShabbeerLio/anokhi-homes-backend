// const rankSlabs = require("../utils/rankSlabs");
// const User = require("../models/User");

// const updateRank = async (userId) => {
//   try {
//     const user = await User.findById(userId);

//     if (!user) return;
//     if (user.rankType === "manual") {
//       return;
//     }

//     // ADMIN NEVER CHANGES
//     if (user.role === "admin") {
//       if (
//         user.level !== 16 ||
//         user.designation !== "Executive Director" ||
//         user.directIncomePercent !== 20
//       ) {
//         user.level = 16;
//         user.designation = "Executive Director";
//         user.directIncomePercent = 20;

//         await user.save();
//       }

//       return;
//     }

//     const totalBusiness =
//       Number(user.selfBusiness || 0) +
//       Number(user.leftBusiness || 0) +
//       Number(user.rightBusiness || 0);

//     const rank = [...rankSlabs]
//       .sort((a, b) => b.min - a.min)
//       .find((r) => totalBusiness >= r.min);

//     if (!rank) return;

//     const changed =
//       user.level !== rank.level ||
//       user.designation !== rank.designation ||
//       user.directIncomePercent !== rank.directIncome;

//     user.totalBusiness = totalBusiness;

//     if (changed) {
//       user.level = rank.level;
//       user.designation = rank.designation;
//       user.directIncomePercent = rank.directIncome;

//       console.log(`${user.name} promoted to ${rank.designation}`);
//     }

//     await user.save();
//   } catch (error) {
//     console.log(error);
//   }
// };

// module.exports = updateRank;

const RankSlab = require("../models/RankSlab");
const User = require("../models/User");

const updateRank = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) return;

    const rankSlabs = await RankSlab.find().sort({ min: 1 });

    if (!rankSlabs.length) {
      console.log("No rank slabs configured");
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

    let rank;

    // =====================================================
    // MANUAL RANK
    // =====================================================
    if (user.rankType === "manual") {
      // Find the slab of the manually assigned level
      const currentSlab = rankSlabs.find((r) => r.level === Number(user.level));

      if (!currentSlab) return;

      /*
       * Start checking from the manually assigned level.
       * User can only move UP from the manual level.
       */
      rank = [...rankSlabs]
        .sort((a, b) => b.level - a.level)
        .find((r) => r.level >= currentSlab.level && totalBusiness >= r.min);

      // If business has not reached the next slab,
      // keep the manually assigned rank.
      if (!rank) {
        rank = currentSlab;
      }
    }

    // =====================================================
    // AUTO RANK
    // =====================================================
    else {
      rank = [...rankSlabs]
        .sort((a, b) => b.min - a.min)
        .find((r) => totalBusiness >= r.min);

      if (!rank) return;
    }

    const changed =
      user.level !== rank.level ||
      user.designation !== rank.designation ||
      user.directIncomePercent !== rank.directIncome;

    user.totalBusiness = totalBusiness;

    if (changed) {
      user.level = rank.level;
      user.designation = rank.designation;
      user.directIncomePercent = rank.directIncome;

      console.log(
        `${user.name} promoted to ${rank.designation} (${rank.directIncome}%)`,
      );
    }

    await user.save();
  } catch (error) {
    console.log(error);
  }
};

module.exports = updateRank;
