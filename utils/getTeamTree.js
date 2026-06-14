const User = require("../models/User");

const getTeamTree = async (userId) => {
  const user = await User.findById(userId)
    .select(
      "name phone referralId position designation selfBusiness directIncomePercent level status wallet totalIncome leftChildren rightChildren",
    )
    .populate(
      "leftChildren",
      "name phone referralId position designation selfBusiness directIncomePercent level status wallet totalIncome leftChildren rightChildren",
    )
    .populate(
      "rightChildren",
      "name phone referralId position designation selfBusiness directIncomePercent level status wallet totalIncome leftChildren rightChildren",
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

  userObj.leftChildren = await Promise.all(
    user.leftChildren.map((child) => getTeamTree(child._id)),
  );

  userObj.rightChildren = await Promise.all(
    user.rightChildren.map((child) => getTeamTree(child._id)),
  );

  return userObj;
};

module.exports = getTeamTree;
