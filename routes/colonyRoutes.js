const express = require("express");
const router = express.Router();
const Colony = require("../models/Colony");


// GET ALL COLONIES
router.get("/", async (req, res) => {

  try {

    const colonies = await Colony.find().populate("locationId");

    res.json(colonies);

  } catch (error) {
    res.status(500).send("Server Error");
  }

});


// GET COLONIES BY LOCATION
router.get("/location/:locationId", async (req, res) => {

  try {

    const colonies = await Colony.find({
      locationId: req.params.locationId
    });

    res.json(colonies);

  } catch (error) {
    res.status(500).send("Server Error");
  }

});


// ADD COLONY
router.post("/add", async (req, res) => {

  try {

    const colony = await Colony.create(req.body);

    res.json(colony);

  } catch (error) {
    res.status(500).send("Server Error");
  }

});


// EDIT COLONY
router.put("/edit/:id", async (req, res) => {

  try {

    const colony = await Colony.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(colony);

  } catch (error) {
    res.status(500).send("Server Error");
  }

});


// DELETE COLONY
router.delete("/delete/:id", async (req, res) => {

  try {

    await Colony.findByIdAndDelete(req.params.id);

    res.json({ message: "Colony deleted" });

  } catch (error) {
    res.status(500).send("Server Error");
  }

});

module.exports = router;