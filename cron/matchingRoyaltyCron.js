const cron = require("node-cron");
const { createPayout } = require("../mlmController/createPayout");

cron.schedule("0 1 * * *", async () => {
  try {
    const today = new Date();

    // January 1st
    if (today.getMonth() === 0 && today.getDate() === 1) {
      const cycleStart = new Date(today.getFullYear() - 1, 6, 1);
      const cycleEnd = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59);

      await createPayout(cycleStart, cycleEnd, today);
    }

    // July 1st
    if (today.getMonth() === 6 && today.getDate() === 1) {
      const cycleStart = new Date(today.getFullYear(), 0, 1);
      const cycleEnd = new Date(today.getFullYear(), 5, 30, 23, 59, 59);

      await createPayout(cycleStart, cycleEnd, today);
    }
  } catch (err) {
    console.log(err);
  }
});
