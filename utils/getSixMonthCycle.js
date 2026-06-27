module.exports = function getSixMonthCycle(date = new Date()) {
  const year = date.getFullYear();

  let cycleStart;
  let cycleEnd;

  if (date.getMonth() < 6) {
    // Jan → Jun
    cycleStart = new Date(year, 0, 1);
    cycleEnd = new Date(year, 5, 30, 23, 59, 59);
  } else {
    // Jul → Dec
    cycleStart = new Date(year, 6, 1);
    cycleEnd = new Date(year, 11, 31, 23, 59, 59);
  }

  return {
    cycleStart,
    cycleEnd,
  };
};