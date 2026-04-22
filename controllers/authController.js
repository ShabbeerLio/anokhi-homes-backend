const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
  try {

    const { name, email, phone, password, role } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      password: hashed,
      role
    });

    res.json(user);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }
};

const login = async (req, res) => {

  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user)
    return res.status(404).json({ msg: "User not found" });

  if (user.status === "inactive") {
    return res.status(403).json({
      msg: "Account inactive by admin. Please contact administrator.",
    });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match)
    return res.status(400).json({ msg: "Invalid password" });

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET
  );

  res.json({ token, user });
};

module.exports = {
  register,
  login
};