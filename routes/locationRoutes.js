const express = require("express");
const router = express.Router();
const Location = require("../models/Location");


// GET ALL LOCATIONS
router.get("/", async (req, res) => {
  try {

    const locations = await Location.find();

    res.json(locations);

  } catch (error) {
    res.status(500).send("Server Error");
  }
});


// ADD LOCATION
router.post("/add", async (req, res) => {

  try {

    const { name, description, image } = req.body;

    const location = await Location.create({
      name,
      description,
      image
    });

    res.json(location);

  } catch (error) {
    res.status(500).send("Server Error");
  }

});


// EDIT LOCATION
router.put("/edit/:id", async (req, res) => {

  try {

    const location = await Location.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(location);

  } catch (error) {
    res.status(500).send("Server Error");
  }

});


// DELETE LOCATION
router.delete("/delete/:id", async (req, res) => {

  try {

    await Location.findByIdAndDelete(req.params.id);

    res.json({ message: "Location deleted" });

  } catch (error) {
    res.status(500).send("Server Error");
  }

});

module.exports = router;