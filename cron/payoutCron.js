const cron = require("node-cron");
const generatePayouts = require("../mlmController/generatePayouts");

// Runs at 00:05 on the 1st and 16th of every month, server-local time
const startPayoutCron = () => {
  cron.schedule("5 0 1,16 * *", async () => {
    console.log("Payout cron triggered:", new Date().toString());
    try {
      const results = await generatePayouts(new Date());
      console.log(`Payout cron: generated ${results.length} payout(s)`);
    } catch (error) {
      console.log("Payout cron error:", error);
    }
  });

  console.log("Payout cron scheduled (1st and 16th of each month, 00:05)");
};

module.exports = startPayoutCron;
