const axios = require("axios");
const crypto = require("crypto");

const sendWhatsappNotification = async ({
  phone,
  templateName,
  bodyParameters = [],
}) => {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: bodyParameters.map((value) => ({
              type: "text",
              text: String(value),
            })),
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
    console.error(
      "WhatsApp Error:",
      err.response?.data || err.message
    );
    throw err;
  }
};

module.exports = sendWhatsappNotification;