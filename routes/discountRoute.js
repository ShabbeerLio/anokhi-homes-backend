const express = require("express");
const router = express.Router();

const Discount = require("../models/Discount");
const User = require("../models/User");

const fetchuser = require("../middleware/fetchUser");

router.get("/", fetchuser, async (req, res) => {
  try {
    const discounts =
      await Discount.find().sort({
        createdAt: -1,
      });

    res.json(discounts);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.post("/add", fetchuser, async (req, res) => {
  try {
    const discount =
      await Discount.create(req.body);

    res.json(discount);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.put("/edit/:id", fetchuser, async (req, res) => {
  try {
    const discount =
      await Discount.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );

    res.json(discount);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.delete(
  "/delete/:id",
  fetchuser,
  async (req, res) => {
    try {
      await Discount.findByIdAndDelete(
        req.params.id
      );

      res.json({
        success: true,
      });
    } catch (error) {
      console.log(error);

      res.status(500).send("Server Error");
    }
  }
);

router.put(
  "/toggle/:id",
  fetchuser,
  async (req, res) => {
    try {
      const discount =
        await Discount.findById(
          req.params.id
        );

      discount.status =
        discount.status === "active"
          ? "inactive"
          : "active";

      await discount.save();

      res.json(discount);
    } catch (error) {
      console.log(error);

      res.status(500).send("Server Error");
    }
  }
);

module.exports = router;