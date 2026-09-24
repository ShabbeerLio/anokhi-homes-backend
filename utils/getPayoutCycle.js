// Run on the 1st  -> 16th to last day of the PREVIOUS month
// Run on the 16th -> 1st to 15th of the current month
const getPayoutCycle = (referenceDate = new Date()) => {
  const date = new Date(referenceDate);
  const day = date.getDate();

  if (day >= 16) {
    const cycleStart = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const cycleEnd = new Date(date.getFullYear(), date.getMonth(), 15, 23, 59, 59, 999);
    return { cycleStart, cycleEnd };
  }

  const prevMonth = date.getMonth() - 1; // Date() rolls negative months into the prior year automatically
  const cycleStart = new Date(date.getFullYear(), prevMonth, 16, 0, 0, 0, 0);
  const cycleEnd = new Date(date.getFullYear(), prevMonth + 1, 0, 23, 59, 59, 999); // day 0 = last day of prevMonth
  return { cycleStart, cycleEnd };
};

module.exports = getPayoutCycle;