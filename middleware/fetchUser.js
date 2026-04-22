const jwt = require("jsonwebtoken");
const User = require("../models/User");

const fetchuser = async (req, res, next) => {
  // Get token from header
  const token = req.header("auth-token");

  // Check if token exists
  if (!token) {
    return res
      .status(401)
      .send({ error: "Please authenticate using valid token" });
  }

  try {
    // Verify token
    const data = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(data.id);

    req.user = user;

    next();
  } catch (error) {
    res.status(401).send({ error: "Invalid Token" });
  }
};

module.exports = fetchuser;
