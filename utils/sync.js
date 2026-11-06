require("dotenv").config();
const mongoose = require("mongoose");
const syncFromSource = require("../utils/syncFromSource");

(async () => {
  await mongoose.connect(process.env.MONGO_URI); // target
  const report = await syncFromSource({
    dryRun: process.argv.includes("--dry"),
    mirrorDeletes: process.argv.includes("--mirror"),
  });
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
})();