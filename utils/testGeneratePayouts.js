// scripts/testGeneratePayouts.js
require("dotenv").config();
const mongoose = require("mongoose");
const generatePayouts = require("../mlmController/generatePayouts");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const now = new Date();
  console.log("Running for:", now.toString()); // local-readable, e.g. "Tue Sep 01 2026 ..."

  const results = await generatePayouts(now);

  console.log(`Generated ${results.length} payout(s)`);
  results.forEach((p) =>
    console.log(
      p.user.toString(),
      "gross:", p.grossAmount,
      "tds:", p.tdsAmount,
      "admin:", p.adminChargeAmount,
      "net:", p.netAmount,
    ),
  );

  await mongoose.disconnect();
  process.exit(0);
})();