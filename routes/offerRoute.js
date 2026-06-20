const express = require("express");
const router = express.Router();

const Offer = require("../models/Offer");
const User = require("../models/User");

const fetchuser = require("../middleware/fetchUser");

router.get("/", fetchuser, async (req, res) => {
  try {
    const offers = await Offer.find()
      .populate("colonyId", "name")
      .sort({ createdAt: -1 });

    res.json(offers);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.post("/add", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    const offer = await Offer.create(req.body);

    res.json(offer);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.put("/edit/:id", fetchuser, async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json(offer);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.put("/toggle/:id", fetchuser, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);

    offer.status = offer.status === "active" ? "inactive" : "active";

    await offer.save();

    res.json(offer);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

module.exports = router;
