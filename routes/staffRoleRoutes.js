const express = require("express");
const router = express.Router();
const StaffRole = require("../models/StaffRole");
const fetchUser = require("../middleware/fetchUser");

router.get("/", fetchUser, async (req, res) => {
  const roles = await StaffRole.find();
  res.json(roles);
});

router.get("/:id", fetchUser, async (req, res) => {
  const role = await StaffRole.findById(req.params.id);
  res.json(role);
});

router.post("/add", fetchUser, async (req, res) => {
  const role = await StaffRole.create({
    name: req.body.name,
    slug: req.body.slug,
    permissions: req.body.permissions,
  });
  res.json(role);
});

router.put("/edit/:id", fetchUser, async (req, res) => {
  const role = await StaffRole.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(role);
});

router.delete("/delete/:id", fetchUser, async (req, res) => {
  await StaffRole.findByIdAndDelete(req.params.id);
  res.json({
    message: "Role deleted",
  });
});

module.exports = router;
