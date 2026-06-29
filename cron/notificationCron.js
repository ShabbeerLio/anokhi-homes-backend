const cron = require("node-cron");
const Notification = require("../models/Notification");

cron.schedule("0 * * * *", async () => {
  try {
    const before24Hours = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    );

    const result = await Notification.deleteMany({
      isRead: true,
      readAt: {
        $lte: before24Hours,
      },
    });

    console.log(
      `${result.deletedCount} notifications deleted`
    );
  } catch (err) {
    console.log(err);
  }
});