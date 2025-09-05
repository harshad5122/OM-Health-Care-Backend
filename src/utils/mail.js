const mailer = require('nodemailer');
const logger = require('./logger');
const ejs = require('ejs');
const path = require('path');

const smtpProtocol = mailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});
// const sendMailToUser = (template, receiver, subject, res, content) => {
//     res.render(template, { receiver, content }, (err, data) => {
//         if (err) {
//             logger.error('Error in rendering template.', err);
//         } else {
//             const mailoption = {
//                 from: process.env.EMAIL_USER,
//                 to: receiver,
//                 subject: subject,
//                 html: data
//             }

//             smtpProtocol.sendMail(mailoption, function (err, response) {
//                 if (err) {
//                     smtpProtocol.close();
//                     return logger.error('Error in sending email.', err);
//                 }
//                 logger.info(`Email sent successfully to ${content.firstname} ${content.lastname}`);
//                 smtpProtocol.close();
//             });
//         }
//     })
// }

const sendMailToUser = async (template, receiver, subject, content) => {
  try {
    // Find template file in public/mailTemplate
    const templatePath = path.join(__dirname, '../public/mailTemplate', template);

    // Render ejs template to HTML
    const data = await ejs.renderFile(templatePath, { content });

    // Email options
    const mailOption = {
      from: process.env.EMAIL_USER,
      to: receiver,
      subject: subject,
      html: data,
    };

    await smtpProtocol.sendMail(mailOption);
    logger.info(` Email sent successfully to ${content.firstname} ${content.lastname}`);
  } catch (err) {
    logger.error(' Error in sending email.', err);
  }
};

module.exports = {
    sendMailToUser,
};