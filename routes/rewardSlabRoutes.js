const express = require("express");
const router = express.Router();

const Reward = require("../models/Reward");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");
const UserReward = require("../models/UserReward");
const IncomeHistory = require("../models/IncomeHistory");

/* =========================
   GET ALL REWARDS
========================= */

router.get("/", fetchuser, async (req, res) => {
  try {
    const rewards = await Reward.find().sort({
      level: 1,
    });

    res.json(rewards);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =========================
   ADD REWARD
========================= */

router.post("/add", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({
        message: "Access Denied",
      });
    }

    const { level, targetBusiness, rewardCash, rewardName, royaltyPercent } =
      req.body;

    const reward = await Reward.create({
      level,
      targetBusiness,
      rewardCash,
      rewardName,
      royaltyPercent,
    });

    res.json(reward);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =========================
   UPDATE REWARD
========================= */

router.put("/edit/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({
        message: "Access Denied",
      });
    }

    const reward = await Reward.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!reward) {
      return res.status(404).json({
        message: "Reward not found",
      });
    }

    res.json(reward);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =========================
   DELETE REWARD
========================= */

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({
        message: "Access Denied",
      });
    }

    const reward = await Reward.findByIdAndDelete(req.params.id);

    if (!reward) {
      return res.status(404).json({
        message: "Reward not found",
      });
    }

    res.json({
      success: true,
      message: "Reward deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =========================
   GET SINGLE REWARD
========================= */

router.get("/my-rewards", fetchuser, async (req, res) => {
  try {
    const rewards = await UserReward.find({
      user: req.user.id,
    })
      .populate("reward")
      .sort({ createdAt: -1 });

    res.json(rewards);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/claim-cash/:id", fetchuser, async (req, res) => {
  try {
    const userReward = await UserReward.findById(req.params.id).populate(
      "reward",
    );

    if (!userReward)
      return res.status(404).json({
        msg: "Reward not found",
      });
    if (userReward.user.toString() !== req.user.id) {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    if (userReward.status === "claimed") {
      return res.status(400).json({
        msg: "Already claimed",
      });
    }
    const user = await User.findById(req.user.id);
    user.wallet += userReward.reward.rewardCash;
    user.totalIncome += userReward.reward.rewardCash;
    await user.save();
    userReward.status = "claimed";
    userReward.selectedOption = "cash";
    userReward.claimedAt = new Date();

    if (userReward.reward.royaltyPercent > 0) {
      userReward.royaltyActivated = true;
      userReward.royaltyPercent = userReward.reward.royaltyPercent;
    }

    await userReward.save();
    await IncomeHistory.create({
      user: user._id,
      type: "reward_income",
      amount: userReward.reward.rewardCash,
      rewardName: userReward.reward.rewardName,
      status: "credited",
    });

    res.json({
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
});

router.put("/claim-reward/:id", fetchuser, async (req, res) => {
  try {
    const userReward = await UserReward.findById(req.params.id).populate(
      "reward",
    );
    if (userReward.user.toString() !== req.user.id) {
      return res.status(403).json({
        msg: "Access denied",
      });
    }

    if (!userReward)
      return res.status(404).json({
        msg: "Reward not found",
      });

    if (userReward.status === "claimed") {
      return res.status(400).json({
        msg: "Already claimed",
      });
    }
    userReward.status = "claimed";
    userReward.selectedOption = "gift";
    userReward.claimedAt = new Date();
    if (userReward.reward.royaltyPercent > 0) {
      userReward.royaltyActivated = true;
      userReward.royaltyPercent = userReward.reward.royaltyPercent;
    }
    await userReward.save();
    res.json({
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/royalty-users", fetchuser, async (req, res) => {
  try {
    const royaltyUsers = await UserReward.find({
      royaltyActivated: true,
    })
      .populate("user", "name phone referralId selfBusiness")
      .populate("reward");

    res.json(royaltyUsers);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});
router.get("/:id", fetchuser, async (req, res) => {
  try {
    const reward = await Reward.findById(req.params.id);

    if (!reward) {
      return res.status(404).json({
        message: "Reward not found",
      });
    }

    res.json(reward);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
