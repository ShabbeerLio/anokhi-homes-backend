const User = require("../models/User");
const updateRank = require("./updateRank");

const updateBusiness = async (
  userId,
  amount,
) => {
  let currentUser = await User.findById(
    userId,
  );

  if (!currentUser) return;

  currentUser.selfBusiness += amount;

  await currentUser.save();

  let parentId = currentUser.parent;

  let level = 1;

  while (parentId && level <= 16) {
    const parent = await User.findById(
      parentId,
    );

    if (!parent) break;

    if (currentUser.position === "left") {
      parent.leftBusiness += amount;
    }

    if (currentUser.position === "right") {
      parent.rightBusiness += amount;
    }

    parent.totalBusiness =
      parent.leftBusiness +
      parent.rightBusiness;

    await parent.save();

    await updateRank(parent._id);

    currentUser = parent;

    parentId = parent.parent;

    level++;
  }
};

module.exports = updateBusiness;