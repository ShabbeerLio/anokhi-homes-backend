const cron = require("node-cron");
const { createPayout } = require("../mlmController/createPayout");

/*
Runs everyday at 1:00 AM

Only generates payout on
1st & 16th
*/

cron.schedule("0 1 * * *", async () => {
  try {
    const today = new Date();

    let cycleStart;
    let cycleEnd;
    let releaseDate;

    //----------------------------------------------------
    // 1st of Month
    // Generate payout for
    // 1st -15th of PREVIOUS month
    //----------------------------------------------------

    if (today.getDate() === 1) {
      const previousMonth = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
      );

      cycleStart = new Date(
        previousMonth.getFullYear(),
        previousMonth.getMonth(),
        1,
      );

      cycleEnd = new Date(
        previousMonth.getFullYear(),
        previousMonth.getMonth(),
        15,
        23,
        59,
        59,
      );

      releaseDate = new Date(today);

      await createPayout(cycleStart, cycleEnd, releaseDate);

      console.log("1st Cycle Payout Generated");
    }

    //----------------------------------------------------
    // 16th of Month
    // Generate payout for
    // 16th-last day of PREVIOUS month
    //----------------------------------------------------

    if (today.getDate() === 16) {
      const previousMonth = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
      );

      cycleStart = new Date(
        previousMonth.getFullYear(),
        previousMonth.getMonth(),
        16,
      );

      cycleEnd = new Date(
        previousMonth.getFullYear(),
        previousMonth.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      releaseDate = new Date(today);

      await createPayout(cycleStart, cycleEnd, releaseDate);

      console.log("2nd Cycle Payout Generated");
    }
  } catch (err) {
    console.log(err);
  }
});
