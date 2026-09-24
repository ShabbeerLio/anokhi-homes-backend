const getCurrentInProgressCycle = (date = new Date()) => {
  const day = date.getDate();

  if (day >= 16) {
    // 16th through end of month (in progress)
    const cycleStart = new Date(date.getFullYear(), date.getMonth(), 16, 0, 0, 0, 0);
    const cycleEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { cycleStart, cycleEnd };
  }

  // 1st through 15th (in progress)
  const cycleStart = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const cycleEnd = new Date(date.getFullYear(), date.getMonth(), 15, 23, 59, 59, 999);
  return { cycleStart, cycleEnd };
};

module.exports = getCurrentInProgressCycle;