const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchUser");
const Notification = require("../models/Notification");

router.get("/", fetchuser, async (req, res) => {
  const notifications = await Notification.find({
    user: req.user.id,
  }).sort({
    createdAt: -1,
  });

  res.json(notifications);
});

router.put("/read/:id", fetchuser, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();

    await notification.save();

    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.put("/read-all", fetchuser, async (req, res) => {
  await Notification.updateMany(
    {
      user: req.user.id,
      isRead: false,
    },
    {
      isRead: true,
    },
  );

  res.json({
    success: true,
  });
});

router.delete("/:id", fetchuser, async (req, res) => {
  await Notification.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
  });
});

router.get("/count", fetchuser, async (req, res) => {
  const count = await Notification.countDocuments({
    user: req.user.id,
    isRead: false,
  });

  res.json({
    unread: count,
  });
});

module.exports = router;
