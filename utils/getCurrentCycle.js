module.exports = function getCurrentCycle(date = new Date()) {
  let cycleStart;
  let cycleEnd;

  if (date.getDate() <= 15) {
    cycleStart = new Date(date.getFullYear(), date.getMonth(), 1);
    cycleEnd = new Date(date.getFullYear(), date.getMonth(), 15, 23, 59, 59);
  } else {
    cycleStart = new Date(date.getFullYear(), date.getMonth(), 16);
    cycleEnd = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59
    );
  }

  return {
    cycleStart,
    cycleEnd,
  };
};