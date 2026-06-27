const express = require("express");
const router = express.Router();

const fetchuser = require("../middleware/fetchUser");

const User = require("../models/User");
const PayoutSetting = require("../models/PayoutSetting");

router.get("/", fetchuser, async (req, res) => {
  try {
    let setting = await PayoutSetting.findOne();

    if (!setting) {
      setting = await PayoutSetting.create({
        tdsPercent: 2,
        adminChargePercent: 5,
      });
    }

    res.json(setting);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

//
// UPDATE SETTINGS
//
router.put("/", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Only admin can update payout settings",
      });
    }

    const {
      tdsPercent,
      adminChargePercent,
    } = req.body;

    let setting = await PayoutSetting.findOne();

    if (!setting) {
      setting = await PayoutSetting.create({
        tdsPercent,
        adminChargePercent,
      });
    } else {
      if (tdsPercent !== undefined) {
        setting.tdsPercent = Number(tdsPercent);
      }

      if (adminChargePercent !== undefined) {
        setting.adminChargePercent = Number(
          adminChargePercent
        );
      }

      await setting.save();
    }

    res.json({
      success: true,
      message: "Payout settings updated successfully.",
      setting,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;