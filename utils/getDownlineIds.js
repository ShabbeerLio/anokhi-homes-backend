const User = require("../models/User");

async function getDownlineIds(userId) {
  const ids = [];
  const queue = [userId];

  while (queue.length) {
    const currentId = queue.shift();
    const currentUser = await User.findById(currentId).select(
      "leftChildren rightChildren",
    );
    if (!currentUser) continue;

    const children = [
      ...(currentUser.leftChildren || []),
      ...(currentUser.rightChildren || []),
    ];

    for (const childId of children) {
      ids.push(childId);
      queue.push(childId); // keep expanding — grandchildren, etc.
    }
  }

  return ids;
}

module.exports = getDownlineIds;
