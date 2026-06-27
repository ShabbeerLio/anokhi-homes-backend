const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchUser");
const hold = require("../controllers/holdController");

router.get("/", fetchuser, hold.getHolds);
router.post("/free", fetchuser, hold.freeHold);
router.post("/paid", fetchuser, hold.paidHold);
router.get("/settings", fetchuser, hold.getSettings);

router.put(
    "/settings",
    fetchuser,
    hold.updateSettings
);
router.put("/action/:id", fetchuser, hold.holdAction);

module.exports = router;
