const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const { login, register } = require("../controllers/authController");
const fetchuser = require("../middleware/fetchUser");
const User = require("../models/User");
const StaffRole = require("../models/StaffRole");

/* AUTH */
router.post("/login", login);
router.post("/register", register);
router.post("/create-user", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    // Only admin can create accounts
    if (loggedUser.role !== "admin") {
      return res.status(403).json({
        msg: "Only admin can create users",
      });
    }

    const { name, email, phone, password, role } = req.body;
    console.log(name, email, phone, password, role);

    // check if user exists
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
    });

    res.json({
      msg: "User created successfully",
      user,
    });
  } catch (error) {
    console.error(error.message);
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

/* GET LOGGED IN USER */
router.post("/getuser", fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("-password");

    res.send(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server Error");
  }
});

/* ===========================
   GET ALL USERS
=========================== */

router.get("/all-users", fetchuser, async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.json(users);
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

/* ===========================
   GET user by role
=========================== */

router.get("/role/:role", fetchuser, async (req, res) => {
  try {
    const users = await User.find({ role: req.params.role }).select(
      "-password",
    );

    res.json(users);
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

router.put("/update/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    const targetUserId = req.params.id;

    // allow if self OR admin/staff
    if (
      loggedUser._id.toString() !== targetUserId &&
      loggedUser.role !== "admin" &&
      loggedUser.role !== "staff"
    ) {
      return res.status(403).json({
        msg: "Not allowed to update other users",
      });
    }

    const { name, phone, role, status } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      { name, phone, role, status },
      { new: true },
    ).select("-password");

    res.json(updatedUser);
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (loggedUser.role !== "admin" && loggedUser.role !== "staff") {
      return res.status(403).json({
        msg: "Only admin or staff can delete users",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      msg: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

router.put("/status/:id", fetchuser, async (req, res) => {
  try {
    const { status } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    res.json(user);
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

router.put("/roles/permissions/:roleName", fetchuser, async (req, res) => {

  try {

    const admin = await User.findById(req.user.id);

    if (admin.role !== "admin") {
      return res.status(403).json({
        msg: "Only admin allowed"
      });
    }

    const { permissions } = req.body;

    const role = await StaffRole.findOneAndUpdate(
      { roleName: req.params.roleName },
      { permissions },
      { new: true, upsert: true }
    );

    res.json({
      msg: "Permissions updated successfully",
      role
    });

  } catch (error) {
    res.status(500).send("Server error");
  }

});

module.exports = router;
