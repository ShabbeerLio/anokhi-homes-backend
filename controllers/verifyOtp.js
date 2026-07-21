const Otp = require("../models/Otp");

exports.verifyOtp = async (req, res) => {
        console.log("trsting working verify")
  try {
    const { phone, otp } = req.body;

    const record = await Otp.findOne({
      phone,
      otp,
    });

    if (!record) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({
        message: "OTP expired",
      });
    }

    await Otp.deleteOne({
      _id: record._id,
    });

    res.json({
      success: true,
      message: "OTP verified",
    });
  } catch (err) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};