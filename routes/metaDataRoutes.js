// routes/metaRoutes.js

const express = require("express");
const router = express.Router();

const MetaData = require("../models/MetaData");
const fetchuser = require("../middleware/fetchuser");

/* GET */
router.get("/", async (req, res) => {
  try {
    const data = await MetaData.findOne();
    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* ADD */
router.post("/add", fetchuser, async (req, res) => {
  try {
    const existing = await MetaData.findOne();

    if (existing) {
      return res.status(400).json({
        message: "Meta already exists",
      });
    }

    const data = await MetaData.create(req.body);

    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* EDIT */
router.put("/edit", fetchuser, async (req, res) => {
  try {
    const data = await MetaData.findOneAndUpdate(
      {},
      req.body,
      { new: true }
    );

    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.put("/edit/:page", fetchuser, async (req, res) => {
  try {
    const { page } = req.params; // home, about, gallery etc

    const update = {};

    // 🔥 dynamically set only that page
    update[page] = req.body;

    const data = await MetaData.findOneAndUpdate(
      {},
      { $set: update },
      { new: true }
    );

    res.json(data);

  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* DELETE */
router.delete("/delete", fetchuser, async (req, res) => {
  try {
    await MetaData.deleteMany();
    res.json({ message: "Meta deleted" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;