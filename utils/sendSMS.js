const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendSMS = async (phone, otp) => {
  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_SMS_NUMBER, // Example: +15017122661
      to: phone,
      body: `Your OTP for login is ${otp}. It is valid for 5 minutes.`,
    });

    console.log("SMS SID:", message.sid);

    return {
      success: true,
      sid: message.sid,
    };
  } catch (err) {
    console.error("SMS Error:", err);

    throw err;
  }
};

module.exports = sendSMS;