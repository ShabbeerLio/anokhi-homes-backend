const cron = require("node-cron");

const PlotHold = require("../models/PlotHold");
const Colony = require("../models/Colony");

cron.schedule("0 * * * *", async () => {
  const expired = await PlotHold.find({
    status: "ACTIVE",
    expiresAt: {
      $lte: new Date(),
    },
  });

  for (const hold of expired) {
    hold.status = "EXPIRED";

    await hold.save();

    const colony = await Colony.findById(hold.colony);

    if (!colony) continue;

    const plot = colony.layout.plots.id(hold.plotId);

    if (!plot) continue;

    plot.plotType = "FOR_SALE";

    await colony.save();
  }
});
