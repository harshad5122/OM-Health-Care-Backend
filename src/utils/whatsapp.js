// const fetch = require("node-fetch"); 
// const { logger } = require("./index"); 

// const sendWhatsAppMessage = async (to, message) => {
//   try {
//     const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
//     const token = process.env.WHATSAPP_ACCESS_TOKEN;
//     const apiUrl = process.env.WHATSAPP_API_URL;

//     if (!phoneNumberId || !token) {
//       logger.error("WhatsApp config missing in .env");
//       return;
//     }

//     // Clean up the phone number (remove +, spaces)
//     const cleanNumber = to.replace(/[^0-9]/g, "");

//     const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         messaging_product: "whatsapp",
//         to: cleanNumber,
//         type: "text",
//         text: { body: message },
//       }),
//     });

//     const data = await response.json();

//     if (data.error) {
//       logger.error("WhatsApp send error:", JSON.stringify(data.error));
//     } else {
//       logger.info(` WhatsApp message sent to ${cleanNumber}`);
//     }
//   } catch (error) {
//     logger.error("Error sending WhatsApp message:", error);
//   }
// };

// module.exports = { sendWhatsAppMessage };


// utils/whatsapp.js
const { logger } = require("./index"); // use existing logger

// const sendWhatsAppMessage = async (to, message) => {
//   try {
//     const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
//     const token = process.env.WHATSAPP_ACCESS_TOKEN;
//     const apiUrl = process.env.WHATSAPP_API_URL;

//     if (!phoneNumberId || !token) {
//       logger.error("WhatsApp config missing in .env");
//       return;
//     }

//     // Clean up the phone number (remove +, spaces)
//     let cleanNumber = to.replace(/[^0-9]/g, "");

//     if (cleanNumber.length === 10) { // Simple check for Indian numbers without country code
//         logger.info(`Prepending country code '91' to ${cleanNumber}`);
//             cleanNumber = `91${cleanNumber}`;
//         }
// logger.info(`Attempting to send WhatsApp to cleaned number: ${cleanNumber}`);
//     //  Use global fetch (Node 18+)
//     const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         messaging_product: "whatsapp",
//         to: cleanNumber,
//         type: "text",
//         text: { body: message },
//       }),
//     });

//     const data = await response.json();

//     if (!response.ok) {
//       logger.error(
//         `WhatsApp API Error (${response.status}): ${JSON.stringify(data, null, 2)}`
//       );
//       return;
//     }


//     if (data.error) {
//       logger.error("WhatsApp send error:", JSON.stringify(data.error));
//     } else {
//       logger.info(` WhatsApp message sent to ${cleanNumber}`);
//     }
//   } catch (error) {
//     logger.error("Error sending WhatsApp message:", error);
//   }
// };

const sendWhatsAppMessage = async (to, templateName, templateParams = []) => {
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const apiUrl = process.env.WHATSAPP_API_URL;

    if (!phoneNumberId || !token) {
      logger.error("WhatsApp config missing in .env");
      return;
    }

    let cleanNumber = to.replace(/[^0-9]/g, "");
    if (cleanNumber.length === 10) {
      cleanNumber = `91${cleanNumber}`;
    }

    logger.info(`Sending template '${templateName}' to ${cleanNumber}`);

    // This is the new request body structure for templates
    const requestBody = {
      messaging_product: "whatsapp",
      to: cleanNumber,
      type: "template",
      template: {
        name: templateName, // The name of your template, e.g., "user_welcome"
        language: {
          code: "en_US", // Or the language code you used
        },
        components: [
          {
            type: "body",
            parameters: templateParams.map(param => ({ type: "text", text: param })),
          },
        ],
      },
    };

    const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error(
        `WhatsApp API Error (${response.status}): ${JSON.stringify(data, null, 2)}`
      );
      return;
    }

    if (data.error) {
      logger.error("WhatsApp send error:", JSON.stringify(data.error));
    } else {
      logger.info(`✅ WhatsApp message sent to ${cleanNumber}`);
    }
  } catch (error) {
    logger.error("Error in sendWhatsAppMessage function:", error);
  }
};


module.exports = { sendWhatsAppMessage };
