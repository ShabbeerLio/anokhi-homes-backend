const Otp = require("../models/Otp");
const sendSMS = require("../utils/sendSMS");
const sendWhatsapp = require("../utils/sendWhatsapp");

exports.sendOtp = async (req, res) => {
  try {
    const { phone, type = "sms" } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndDelete({ phone });

    await Otp.create({
      phone,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    if (type === "whatsapp") {
      await sendWhatsapp(phone, otp);
    } else {
      await sendSMS(phone, otp);
    }

    return res.json({
      success: true,
      message: `OTP sent via ${type}`,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};