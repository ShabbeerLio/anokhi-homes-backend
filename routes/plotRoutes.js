const express = require("express");
const router = express.Router();
const Colony = require("../models/Colony");


/* =============================
   GET FULL LAYOUT
============================= */

router.get("/:colonyId", async (req, res) => {

  try {

    const colony = await Colony.findById(req.params.colonyId);

    res.json(colony.layout);

  } catch (error) {
    res.status(500).send("Server Error");
  }

});


/* =============================
   SAVE / UPDATE FULL LAYOUT
   (ADD + EDIT PLOTS + MAINPLOT)
============================= */

router.post("/save/:colonyId", async (req, res) => {

  try {

    const { layout } = req.body;

    const colony = await Colony.findByIdAndUpdate(
      req.params.colonyId,
      { layout },
      { new: true }
    );

    res.json(colony.layout);

  } catch (error) {
    res.status(500).send("Server Error");
  }

});


/* =============================
   DELETE PLOT
============================= */

router.delete("/delete/:colonyId/:plotId", async (req, res) => {

  try {

    const colony = await Colony.findById(req.params.colonyId);

    colony.layout.plots = colony.layout.plots.filter(
      p => p.plotId !== req.params.plotId
    );

    await colony.save();

    res.json(colony.layout);

  } catch (error) {
    res.status(500).send("Server Error");
  }

});

module.exports = router;