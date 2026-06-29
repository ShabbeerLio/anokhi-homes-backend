require("dotenv").config();
const cron = require("node-cron");
const connectToMongo = require("./db");
connectToMongo();
require("./utils/checker");
// require("./utils/payoutCycle");
// require("./utils/matchingIncomeCycle");
// require("./utils/royaltyCycle");
require("./utils/royaltydistribution");
require("./cron/holdExpiryCron");
require("./cron/ticketExpiryCron");
require("./cron/payoutCron");
require("./cron/notificationCron");
require("./cron/releasePayoutCron");

const express = require("express");
const cors = require("cors");

// Connect to MongoDB
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({ origin: "*" }));
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Available routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/location", require("./routes/locationRoutes"));
app.use("/api/colony", require("./routes/colonyRoutes"));
app.use("/api/plot", require("./routes/plotRoutes"));
app.use("/api/lead", require("./routes/leadRoutes"));
app.use("/api/sitevisit", require("./routes/sitevisitRoutes"));
app.use("/api/booking", require("./routes/bookingRoutes"));
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/landing", require("./routes/landingRoutes"));
app.use("/api/wallet", require("./routes/mlmRoutes"));
app.use("/api/rewards", require("./routes/rewardSlabRoutes"));
app.use("/api/offer", require("./routes/offerRoute"));
app.use("/api/discount", require("./routes/discountRoute"));
app.use("/api/cashback", require("./routes/cashbackRoutes"));
app.use("/api/help", require("./routes/helpTicketRoutes"));
app.use("/api/payment-terms", require("./routes/paymentTermsRoutes"));
app.use("/api/plothold", require("./routes/plotHoldRoutes"));
app.use("/api/payout-settings", require("./routes/payoutSetting"));
app.use("/api/rating", require("./routes/ratingRoutes"));
app.use("/api/notification", require("./routes/notificationRoutes"));
app.use("/api/staff-role", require("./routes/staffRoleRoutes"));

app.get("/", (req, res) => {
  res.json({ message: "Hello MERN Stack! " });
});

// Start server
app.listen(PORT, () => {
  console.log(`Anokhi homes backend listening on port ${PORT}`);
});
