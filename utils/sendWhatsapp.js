const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendWhatsapp = async (phone, otp) => {
  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${phone}`,
      body: `Your OTP for login is ${otp}. It is valid for 5 minutes.`,
    });

    console.log("WhatsApp SID:", message.sid);

    return {
      success: true,
      sid: message.sid,
    };
  } catch (err) {
    console.error("WhatsApp Error:", err);

    throw err;
  }
};

module.exports = sendWhatsapp;