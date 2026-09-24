const IncomeHistory = require("../models/IncomeHistory");
const User = require("../models/User");

const getTeamTree = async (userId) => {
  const user = await User.findById(userId)
    .select(
      "name phone referralId position designation selfBusiness leftBusiness rightBusiness totalBusiness directIncomePercent level status wallet  leftChildren rightChildren",
    )
    .populate(
      "leftChildren",
      "name phone referralId position designation selfBusiness directIncomePercent level status wallet  leftChildren rightChildren",
    )
    .populate(
      "rightChildren",
      "name phone referralId position designation selfBusiness directIncomePercent level status wallet  leftChildren rightChildren",
    )
    .populate({
      path: "referredBy",
      select: "referralId ",
      populate: [
        {
          path: "referralId",
          select: "referralId",
        },
      ],
    });

  if (!user) return null;

  const userObj = user.toObject();

  const income = await IncomeHistory.aggregate([
    {
      $match: {
        user: user._id,
        status: "credited",
      },
    },
    {
      $group: {
        _id: "$user",
        totalIncome: { $sum: "$amount" },
      },
    },
  ]);

  userObj.totalIncome =
    income.length > 0 ? income[0].totalIncome : 0;

  userObj.leftChildren = await Promise.all(
    user.leftChildren.map((child) => getTeamTree(child._id)),
  );

  userObj.rightChildren = await Promise.all(
    user.rightChildren.map((child) => getTeamTree(child._id)),
  );

  // Count nodes in a subtree
  const countNodes = (nodes) => {
    let count = 0;

    for (const node of nodes) {
      if (!node) continue;

      count += 1;

      count += countNodes(node.leftChildren || []);
      count += countNodes(node.rightChildren || []);
    }

    return count;
  };

  userObj.totalLeftTeam = countNodes(userObj.leftChildren);
  userObj.totalRightTeam = countNodes(userObj.rightChildren);
  userObj.totalTeam = userObj.totalLeftTeam + userObj.totalRightTeam;
  return userObj;
};

module.exports = getTeamTree;
