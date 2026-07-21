const axios = require("axios");
const crypto = require("crypto");

const sendWhatsappOTP = async (phone, otp) => {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: phone, // Example: 919582357785
      type: "template",
      template: {
        name: "anokhihomesotp",
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: otp.toString(),
              },
            ],
          },

          // Remove this block if you remove the URL button
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              {
                type: "text",
                text: "verify",
              },
            ],
          },
        ],
      },
    };

    const response = await axios.post(
      process.env.INFIQ_URL,
      payload,
      {
        headers: {
          "X-INFIQ-API-KEY": process.env.INFIQ_API_KEY,
          "Content-Type": "application/json",
          "X-Idempotency-Key": crypto.randomUUID(),
        },
      }
    );

    return response.data;
  } catch (err) {
    console.log(
      err.response?.data || err.message
    );
    throw err;
  }
};

module.exports = sendWhatsappOTP;

