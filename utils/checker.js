const cron = require("node-cron");
const Lead = require("../models/Lead");

cron.schedule("0 * * * *", async () => {
  console.log("Checking unresponsive leads...");

  const now = new Date();
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const leads = await Lead.find({
    status: "assigned",
    isAccepted: false,
    assignedAt: { $lte: past24h },
  });

  for (let lead of leads) {
    lead.status = "unassigned";
    lead.agent = null;
    lead.isAccepted = false;

    lead.notes.push({
      text: "Associate did not respond within 24 hours",
    });

    await lead.save();
  }
});
