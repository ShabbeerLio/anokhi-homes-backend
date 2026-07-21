const express = require("express");
const router = express.Router();
const Offer = require("../models/Offer");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchUser");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const OfferClaim = require("../models/OfferClaim");

const isAdminOrStaff = (role) => {
  return role === "admin" || role === "staff";
};

async function getBookingPaymentPercent(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking || !booking.finalAmount) return 0;
  const payments = await Payment.aggregate([
    {
      $match: {
        booking: booking._id,
        status: "approved",
      },
    },
    {
      $group: {
        _id: null,
        totalPaid: {
          $sum: "$amount",
        },
      },
    },
  ]);
  const paid = payments.length ? payments[0].totalPaid : 0;
  return (paid / booking.finalAmount) * 100;
}

async function getBookingCount(agentId, milestone) {
  const bookings = await Booking.find({
    agent: agentId,
    status: "pending",
  });

  let count = 0;

  for (const booking of bookings) {
    switch (milestone.paymentType) {
      case "booking_amount": {
        const exists = await Payment.exists({
          booking: booking._id,
          status: "approved",
          paymentType: "booking",
        });

        if (exists) count++;
        break;
      }

      case "agreement_amount": {
        const exists = await Payment.exists({
          booking: booking._id,
          status: "approved",
          paymentType: "agreement",
        });

        if (exists) count++;
        break;
      }

      case "full_payment": {
        const exists = await Payment.exists({
          booking: booking._id,
          status: "approved",
          paymentType: "full",
        });

        if (exists) count++;
        break;
      }

      case "percentage": {
        const percent = await getBookingPaymentPercent(booking._id);

        if (percent >= milestone.paymentPercent) {
          count++;
        }

        break;
      }
    }
  }

  return count;
}

async function buildMilestoneProgress(user, milestone) {
  let achieved = 0;
  let target = 0;

  switch (milestone.conditionType) {
    case "booking":
      target = milestone.bookingCount;
      achieved = await getBookingCount(user._id, milestone);
      break;

    case "business":
      target = milestone.businessAmount;
      achieved = user.totalBusiness || 0;
      break;

    case "self_business":
      target = milestone.businessAmount;
      achieved = user.selfBusiness || 0;
      break;
    default:
      achieved = 0;
  }

  const progress = target === 0 ? 0 : Math.min(100, (achieved / target) * 100);

  return {
    conditionType: milestone.conditionType,
    paymentType: milestone.paymentType,
    paymentPercent: milestone.paymentPercent,
    target,
    achieved,
    progress: Number(progress.toFixed(2)),
    eligible: achieved >= target,
    rewardMode: milestone.rewardMode,
    rewardOptions: milestone.rewardOptions,
  };
}

router.get("/", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (!loggedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let query = {};

    if (!isAdminOrStaff(loggedUser.role)) {
      query = {
        status: "active",
        $and: [
          {
            $or: [
              { startDate: { $exists: false } },
              { startDate: null },
              { startDate: { $lte: new Date() } },
            ],
          },
          {
            $or: [
              { endDate: { $exists: false } },
              { endDate: null },
              { endDate: { $gte: new Date() } },
            ],
          },
        ],
      };
    }

    const offers = await Offer.find(query)
      .populate("colonyIds", "name")
      .sort({ createdAt: -1 });

    // Admin & Staff get normal offers
    if (isAdminOrStaff(loggedUser.role)) {
      return res.json(offers);
    }

    // Agent/User gets offer with milestone status
    const offersWithProgress = await Promise.all(
      offers.map(async (offer) => {
        const milestones = await Promise.all(
          offer.milestones.map(async (milestone) => {
            const progress = await buildMilestoneProgress(
              loggedUser,
              milestone,
            );

            const claim = await OfferClaim.findOne({
              offer: offer._id,
              rewardIndex: milestone.sortOrder,
              agent: loggedUser._id,
            });

            return {
              ...milestone.toObject(),

              target: progress.target,
              achieved: progress.achieved,
              progress: progress.progress,

              eligible: progress.eligible,
              canClaim: progress.eligible && !claim,

              status: claim
                ? claim.status // claimed | undelivered | delivered
                : progress.eligible
                  ? "eligible"
                  : "locked",

              rewardChoice: claim?.rewardChoice || null,
              selectedReward: claim?.selectedReward || null,
              claimedAt: claim?.claimedAt || null,
            };
          }),
        );

        return {
          ...offer.toObject(),

          milestones,

          totalEligible: milestones.filter((m) => m.status === "eligible")
            .length,

          totalClaimed: milestones.filter((m) =>
            ["claimed", "undelivered", "delivered"].includes(m.status),
          ).length,
        };
      }),
    );

    res.json(offersWithProgress);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

/* ============================================================
   CREATE OFFER
============================================================ */

router.post("/add", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (!isAdminOrStaff(loggedUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const offer = await Offer.create(req.body);
    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      offer,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

/* ============================================================
   UPDATE OFFER
============================================================ */

router.put("/edit/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (!isAdminOrStaff(loggedUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    let offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    Object.assign(offer, req.body);

    await offer.save();

    res.json({
      success: true,
      message: "Offer updated successfully",
      offer,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

/* ============================================================
   DELETE OFFER
============================================================ */

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (!isAdminOrStaff(loggedUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    await offer.deleteOne();

    res.json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

router.put("/toggle/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (!isAdminOrStaff(loggedUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    switch (offer.status) {
      case "draft":
        offer.status = "active";
        break;

      case "active":
        offer.status = "inactive";
        break;

      case "inactive":
        offer.status = "active";
        break;

      case "expired":
        offer.status = "active";
        break;

      default:
        offer.status = "draft";
    }

    await offer.save();

    res.json({
      success: true,
      message: "Offer status updated",
      offer,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

// GET /api/offer/claims
router.get("/claims", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!isAdminOrStaff(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const claims = await OfferClaim.find()
      .populate("agent", "name phone")
      .populate("offer", "title")
      .populate("deliveredBy", "name")
      .sort({ createdAt: -1 });

    res.json(claims);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

router.post("/claim", fetchuser, async (req, res) => {
  try {
    const { offerId, milestoneOrder, rewardChoice, rewardIndex } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    if (offer.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Offer is inactive",
      });
    }

    const today = new Date();

    if (offer.startDate && offer.startDate > today) {
      return res.status(400).json({
        success: false,
        message: "Offer has not started yet",
      });
    }

    if (offer.endDate && offer.endDate < today) {
      return res.status(400).json({
        success: false,
        message: "Offer has expired",
      });
    }

    const milestone = offer.milestones.find(
      (item) => item.sortOrder === milestoneOrder,
    );

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: "Milestone not found",
      });
    }

    const progress = await buildMilestoneProgress(user, milestone);

    if (!progress.eligible) {
      return res.status(400).json({
        success: false,
        message: "Reward not achieved yet",
      });
    }

    const existingClaim = await OfferClaim.findOne({
      offer: offer._id,
      rewardIndex: milestone.sortOrder,
      agent: user._id,
    });

    if (existingClaim) {
      return res.status(400).json({
        success: false,
        message: "Reward already claimed",
      });
    }

    let selectedReward = null;
    if (milestone.rewardMode === "choice") {
      if (rewardIndex === undefined || rewardIndex === null) {
        return res.status(400).json({
          success: false,
          message: "Please select a reward option",
        });
      }
      if (rewardIndex < 0 || rewardIndex >= milestone.rewardOptions.length) {
        return res.status(400).json({
          success: false,
          message: "Invalid reward option",
        });
      }
      selectedReward = milestone.rewardOptions[rewardIndex];
    } else {
      selectedReward = milestone.rewardOptions[0];
      if (!selectedReward) {
        return res.status(400).json({
          success: false,
          message: "Reward not configured",
        });
      }
    }

    if (rewardChoice && !["cash", "reward"].includes(rewardChoice)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reward choice",
      });
    }

    const claimStatus =
      selectedReward.type === "cash" ? "claimed" : "undelivered";

    const claim = await OfferClaim.create({
      offer: offer._id,
      rewardIndex: milestone.sortOrder,
      rewardTarget: progress.target,
      agent: user._id,
      achievedValue: progress.achieved,
      rewardChoice: selectedReward.type === "cash" ? "cash" : "reward",
      selectedReward,
      status: claimStatus,
      claimedAt: new Date(),
    });

    if (!user.claimedRewardLevels.includes(milestone.sortOrder)) {
      user.claimedRewardLevels.push(milestone.sortOrder);

      await user.save();
    }
    return res.status(201).json({
      success: true,

      message:
        selectedReward.type === "cash"
          ? "Cash reward claimed successfully."
          : "Reward claimed successfully. Admin will deliver it soon.",

      claim,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// PUT /api/offer/claim/:id/deliver
router.put("/claim/:id/deliver", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (!isAdminOrStaff(admin.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { remarks } = req.body;

    const claim = await OfferClaim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    if (claim.status !== "undelivered") {
      return res.status(400).json({
        success: false,
        message: "Only undelivered rewards can be delivered.",
      });
    }

    claim.status = "delivered";
    claim.deliveredAt = new Date();
    claim.deliveredBy = admin._id;
    claim.remarks = remarks || "";

    await claim.save();

    res.json({
      success: true,
      message: "Reward delivered successfully.",
      claim,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

// GET /api/offer/my-claims
router.get("/my-claims", fetchuser, async (req, res) => {
  try {
    const claims = await OfferClaim.find({
      agent: req.user.id,
    })
      .populate("offer", "title")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      claims,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

/* ============================================================
   GET SINGLE OFFER
============================================================ */

router.get("/:id", fetchuser, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate(
      "colonyIds",
      "name",
    );

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    res.json({
      success: true,
      offer,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
