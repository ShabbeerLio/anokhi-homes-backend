// routes/homePageRoutes.js

const express = require("express");
const router = express.Router();

const HomePage = require("../models/HomePage");
const fetchuser = require("../middleware/fetchUser");

/* =========================
   GET HOMEPAGE
========================= */
router.get("/", async (req, res) => {
  try {
    const data = await HomePage.findOne();
    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   ADD HOMEPAGE (only once)
========================= */
router.post("/add", fetchuser, async (req, res) => {
  try {
    const existing = await HomePage.findOne();

    if (existing) {
      return res.status(400).json({
        message: "Homepage already exists",
      });
    }

    const data = await HomePage.create(req.body);

    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   EDIT HOMEPAGE
========================= */
router.put("/edit", fetchuser, async (req, res) => {
  try {
    const data = await HomePage.findOneAndUpdate({}, req.body, { new: true });

    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   DELETE HOMEPAGE
========================= */
router.delete("/delete", fetchuser, async (req, res) => {
  try {
    await HomePage.deleteMany();
    res.json({ message: "Homepage deleted" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.delete("/delete-item/:section/:id", fetchuser, async (req, res) => {
  try {
    const { section, id } = req.params;

    const allowedSections = [
      "services",
      "testimonials",
      "gallery",
      "thumbnails",
      "pdfs",
      "address",
      "contact",
      "socialMedia",
    ];

    if (!allowedSections.includes(section)) {
      return res.status(400).json({
        message: "Invalid section",
      });
    }

    const homepage = await HomePage.findOne();

    if (!homepage) {
      return res.status(404).json({
        message: "Homepage not found",
      });
    }

    // 🔥 Remove item by _id
    homepage[section] = homepage[section].filter(
      (item) => item._id.toString() !== id,
    );

    await homepage.save();

    res.json({
      message: `${section} item deleted successfully`,
      data: homepage[section],
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
