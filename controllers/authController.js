const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { notifyAdmins } = require("../utils/notify");

/* =================================
   REGISTER
================================= */

const register = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      staffRole,
      // MLM
      referralId,
      position,

      // EXTRA
      address,
      panNumber,
      panPhoto,
      aadharNumber,
      aadharPhoto,

      bankName,
      accountNumber,
      ifsc,

      nomineeName,
      nomineeRelation,
      nomineeAadharNumber,
      nomineeAadharPhoto,
    } = req.body;

    const existingUser = await User.findOne({
      email,
    });

    if (existingUser) {
      return res.status(400).json({
        msg: "User already exists",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      phone,
      password: hashed,
      role,
      staffRole,
      status: role === "user" ? "active" : "approval",
      address,

      panNumber,
      panPhoto,

      aadharNumber,
      aadharPhoto,

      bankName,
      accountNumber,
      ifsc,

      nomineeName,
      nomineeRelation,
      nomineeAadharNumber,
      nomineeAadharPhoto,

      designation:
        role === "admin"
          ? "Executive Director"
          : role === "agent"
            ? "Sales Executive"
            : "",
      level: role === "admin" ? 16 : role === "agent" ? 1 : "",
      directIncomePercent: role === "admin" ? 20 : role === "agent" ? 5 : "",
    });

    if (role === "agent") {
      // referralId required
      if (!referralId) {
        return res.status(400).json({
          msg: "Referral ID is required",
        });
      }

      // position required
      if (position !== "left" && position !== "right") {
        return res.status(400).json({
          msg: "Position must be left or right",
        });
      }

      // find parent user
      const parentUser = await User.findOne({
        referralId,
      });

      if (!parentUser) {
        return res.status(400).json({
          msg: "Invalid referral ID",
        });
      }

      user.parent = parentUser._id;
      user.referredBy = parentUser._id;
      user.position = position;
      user.level = 1;

      // max 16 levels
      if (user.level > 16) {
        return res.status(400).json({
          msg: "Maximum level reached",
        });
      }
    }
    await user.save();
    await notifyAdmins({
      sender: user._id,
      title: "New User Registration",
      message: `${user.name} has registered as ${user.role}.`,
      type: "system",
      referenceId: user._id,
      referenceModel: "User",
    });
    if (role === "agent") {
      const parentUser = await User.findById(user.parent);

      if (position === "left") {
        parentUser.leftChildren.push(user._id);
      }

      if (position === "right") {
        parentUser.rightChildren.push(user._id);
      }

      parentUser.directTeam += 1;
      parentUser.totalTeam += 1;
      await parentUser.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    const finalUser = await User.findById(user._id).select("-password");

    res.json({
      token,
      user: finalUser,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

/* =================================
   LOGIN
================================= */

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    if (user.status === "approval") {
      return res.status(403).json({
        msg: "Your account is under approval",
      });
    }

    if (user.status === "inactive") {
      return res.status(403).json({
        msg: "Account inactive by admin. Please contact admin.",
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({
        msg: "Invalid password",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({
      token,
      user,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      msg: "Server Error",
    });
  }
};

module.exports = {
  register,
  login,
};
