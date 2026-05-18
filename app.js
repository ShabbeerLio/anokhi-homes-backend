require("dotenv").config();
const connectToMongo = require("./db");
connectToMongo();
require("./utils/checker");
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

app.get("/", (req, res) => {
  res.json({ message: "Hello MERN Stack! " });
});

// Start server
app.listen(PORT, () => {
  console.log(`Anokhi homes backend listening on port ${PORT}`);
});