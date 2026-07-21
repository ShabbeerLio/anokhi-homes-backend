const express = require("express");
const router = express.Router();

const Offer = require("../models/Offer");
const OfferClaim = require("../models/OfferClaim");
const User = require("../models/User");

const fetchuser = require("../middleware/fetchUser");

router.get("/claims", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const claims = await OfferClaim.find()
      .populate("offer", "title poster offerCategory")
      .populate("agent", "name phone referralId designation")
      .populate("deliveredBy", "name")
      .sort({
        createdAt: -1,
      });

    res.json(claims);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.get("/:id/eligible", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    if (offer.status !== "active") {
      return res.status(400).json({
        message: "Offer is not active",
      });
    }

    let currentValue = 0;

    switch (offer.offerCategory) {
      case "business":
        currentValue = loggedUser.totalBusiness || 0;
        break;

      case "booking":
        currentValue = loggedUser.totalBookings || 0;
        break;

      case "sales":
        currentValue = loggedUser.totalSales || 0;
        break;

      default:
        currentValue = loggedUser.totalBusiness || 0;
    }

    const rewards = [];

    for (let i = 0; i < offer.rewards.length; i++) {
      const reward = offer.rewards[i];

      const alreadyClaimed = await OfferClaim.findOne({
        offer: offer._id,
        rewardIndex: i,
        agent: loggedUser._id,
      });

      rewards.push({
        rewardIndex: i,
        rewardTitle: reward.rewardTitle,
        rewardType: reward.rewardType,
        rewardValue: reward.rewardValue,
        rewardImage: reward.rewardImage,
        target: reward.target,
        achievedValue: currentValue,
        eligible: currentValue >= reward.target,
        claimed: !!alreadyClaimed,
        claimStatus: alreadyClaimed?.status || null,
      });
    }

    res.json(rewards);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.get("/:id/stats", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (loggedUser.role !== "admin" && loggedUser.role !== "staff") {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    const claims = await OfferClaim.find({
      offer: offer._id,
    });

    const stats = {
      totalClaims: claims.length,

      eligible: claims.filter((i) => i.status === "eligible").length,

      claimed: claims.filter((i) => i.status === "claimed").length,

      undelivered: claims.filter((i) => i.status === "undelivered").length,

      delivered: claims.filter((i) => i.status === "delivered").length,

      cashClaims: claims.filter(
        (i) =>
          i.rewardChoice === "cash" &&
          (i.status === "claimed" || i.status === "delivered"),
      ).length,

      rewardClaims: claims.filter(
        (i) =>
          i.rewardChoice === "reward" &&
          (i.status === "undelivered" || i.status === "delivered"),
      ).length,
    };

    res.json(stats);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.post("/claim/:claimId", fetchuser, async (req, res) => {
  try {
    const { rewardChoice } = req.body;

    if (!["cash", "reward"].includes(rewardChoice)) {
      return res.status(400).json({
        message: "rewardChoice must be cash or reward",
      });
    }

    const loggedUser = await User.findById(req.user.id);

    const claim = await OfferClaim.findById(req.params.claimId)
      .populate("offer");

    if (!claim) {
      return res.status(404).json({
        message: "Claim not found",
      });
    }

    if (claim.agent.toString() !== loggedUser._id.toString()) {
      return res.status(403).json({
        message: "Not allowed",
      });
    }

    if (claim.status !== "eligible") {
      return res.status(400).json({
        message: "Reward already claimed",
      });
    }

    claim.rewardChoice = rewardChoice;
    claim.claimedAt = new Date();

    if (rewardChoice === "cash") {
      claim.status = "claimed";

      // Add reward amount to wallet
      loggedUser.wallet += claim.offer.rewards[claim.rewardIndex].rewardValue || 0;

      await loggedUser.save();
    } else {
      claim.status = "undelivered";
    }

    await claim.save();

    await claim.populate("offer", "title");
    await claim.populate("agent", "name referralId");

    res.json({
      success: true,
      message:
        rewardChoice === "cash"
          ? "Cash reward claimed successfully."
          : "Reward request submitted successfully.",
      claim,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.put("/claim/:claimId/deliver", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (
      loggedUser.role !== "admin" &&
      loggedUser.role !== "staff"
    ) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const { remarks } = req.body;

    const claim = await OfferClaim.findById(req.params.claimId);

    if (!claim) {
      return res.status(404).json({
        message: "Claim not found",
      });
    }

    if (claim.status !== "undelivered") {
      return res.status(400).json({
        message: "Reward is already delivered or not requested.",
      });
    }

    claim.status = "delivered";
    claim.deliveredAt = new Date();
    claim.deliveredBy = loggedUser._id;
    claim.remarks = remarks || "";

    await claim.save();

    await claim.populate("offer", "title");
    await claim.populate("agent", "name referralId");
    await claim.populate("deliveredBy", "name");

    res.json({
      success: true,
      message: "Reward marked as delivered.",
      claim,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.get("/my", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const today = new Date();

    const offers = await Offer.find({
      status: "active",
      applicableFor: user.role,
      startDate: { $lte: today },
      endDate: { $gte: today },
    })
      .populate("colonyIds", "name")
      .sort({ createdAt: -1 });

    res.json(offers);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.get("/my/rewards", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const today = new Date();

    const offers = await Offer.find({
      status: "active",
      applicableFor: "agent",
      startDate: { $lte: today },
      endDate: { $gte: today },
    });

    let rewards = [];

    for (const offer of offers) {
      let currentValue = 0;

      switch (offer.offerCategory) {
        case "business":
          currentValue = user.totalBusiness || 0;
          break;

        case "booking":
          currentValue = user.totalBookings || 0;
          break;

        case "sales":
          currentValue = user.totalSales || 0;
          break;

        default:
          currentValue = user.totalBusiness || 0;
      }

      for (let i = 0; i < offer.rewards.length; i++) {
        const reward = offer.rewards[i];

        if (currentValue >= reward.target) {
          const claim = await OfferClaim.findOne({
            offer: offer._id,
            rewardIndex: i,
            agent: user._id,
          });

          rewards.push({
            offerId: offer._id,
            offerTitle: offer.title,
            rewardIndex: i,
            rewardTitle: reward.rewardTitle,
            rewardType: reward.rewardType,
            rewardValue: reward.rewardValue,
            rewardImage: reward.rewardImage,
            target: reward.target,
            achievedValue: currentValue,
            status: claim?.status || "eligible",
            claimId: claim?._id || null,
          });
        }
      }
    }

    res.json(rewards);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.get("/my/claims", fetchuser, async (req, res) => {
  try {
    const claims = await OfferClaim.find({
      agent: req.user.id,
    })
      .populate("offer", "title poster offerCategory")
      .populate("deliveredBy", "name")
      .sort({
        createdAt: -1,
      });

    res.json(claims);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

router.get("/progress", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const today = new Date();

    const offers = await Offer.find({
      status: "active",
      applicableFor: "agent",
      startDate: { $lte: today },
      endDate: { $gte: today },
    });

    let progress = [];

    for (const offer of offers) {
      let currentValue = 0;

      switch (offer.offerCategory) {
        case "business":
          currentValue = user.totalBusiness || 0;
          break;

        case "booking":
          currentValue = user.totalBookings || 0;
          break;

        case "sales":
          currentValue = user.totalSales || 0;
          break;

        default:
          currentValue = user.totalBusiness || 0;
      }

      const rewards = offer.rewards.map((reward, index) => {
        const percent = reward.target
          ? Math.min(
              100,
              Number(((currentValue / reward.target) * 100).toFixed(2))
            )
          : 0;

        return {
          rewardIndex: index,
          rewardTitle: reward.rewardTitle,
          rewardType: reward.rewardType,
          rewardValue: reward.rewardValue,
          rewardImage: reward.rewardImage,
          target: reward.target,
          achievedValue: currentValue,
          remaining: Math.max(0, reward.target - currentValue),
          progress: percent,
          eligible: currentValue >= reward.target,
        };
      });

      progress.push({
        offerId: offer._id,
        offerTitle: offer.title,
        offerCategory: offer.offerCategory,
        rewards,
      });
    }

    res.json(progress);
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
});

module.exports = router;