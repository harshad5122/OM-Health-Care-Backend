const UserSchema = require('../../models/user');
const { responseData, messageConstants, mailTemplateConstants, mailSubjectConstants } = require('../../constants');
const { jsonWebToken, cryptoGraphy } = require('../../middlewares');
const { logger, mail } = require('../../utils');
const otpGenerator = require('otp-generator');

const signUp = async (body, res) => { 
  return new Promise(async () => {
    if (!body || !body.password) {
      logger.error('Missing body or password');
      return responseData.fail(res, 'Missing body or password', 400);
    }
    body['password'] = await cryptoGraphy.hashPassword(body.password);
    const userSchema = new UserSchema(body);
    const mailContent = {
      firstname: body.firstname,
      lastname: body.lastname
    }
    await userSchema.save().then(async (result) => {
      delete result?.password;
      logger.info(`User ${body['firstname']} ${body['lastname']} created successfully with ${body['email']}`);
      //await mail.sendMailToUser(mailTemplateConstants.SIGNUP_TEMPLATE, body.email, mailSubjectConstants.SIGNUP_SUBJECT, res, mailContent);
      return responseData.success(res, result, messageConstants.USER_CREATED);
    }).catch((err) => {
      if (err.code === 11000) {
        logger.error(`${Object.keys(err.keyValue)} already exists`);
        return responseData.fail(res, `${Object.keys(err.keyValue)} already exists `, 403);
      } else {
        logger.error(messageConstants.INTERNAL_SERVER_ERROR, err);
        return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
      }
    })
  })
}


const signIn = async (body, res) => {
  return new Promise(async () => {
    try {
      const { loginType } = body; // "email" | "phone"

      // ----------------- LOGIN WITH EMAIL -----------------
      if (loginType === 'email') {
        if (!body.email || !body.password) {
          return responseData.fail(res, messageConstants.EMAIL_PASS_REQUIRED, 400);
        }

        const user = await UserSchema.findOne({ email: body.email, is_deleted: false });

        if (!user) {
          return responseData.fail(res, messageConstants.USER_NOT_FOUND, 404);
        }
        const isMatch = await cryptoGraphy.comparePassword(body.password, user.password);
        if (!isMatch) {
          return responseData.fail(res, messageConstants.EMAIL_PASS_INCORRECT, 401);
        }

        await createJsonWebTokenForUser(user);
        logger.info(`User ${user.firstname || ''} ${user.lastname || ''} logged in with email`);
        return responseData.success(res, user, messageConstants.LOGGEDIN_SUCCESSFULLY);
      }

      if (loginType === 'phone') {
        const { countryCode, phone } = body;

        if (!countryCode || !phone) {
          return responseData.fail(res, messageConstants.PHONE_REQUIRED, 400);
        }

        const phoneForDb = String(phone).trim();
        let user = await UserSchema.findOne({ phone: phoneForDb, is_deleted: false });

        if (!user) {
          user = new UserSchema({ phone: phoneForDb, countryCode });
        }

        // generate OTP
        const generatedOtp = genOtp();

        user.otp = generatedOtp;
        user.otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
        await user.save();

        // TODO: integrate SMS/WhatsApp/email service to actually send OTP
        logger.info(`OTP for ${countryCode}${phoneForDb} is: ${generatedOtp} (valid 5 min)`);

        return responseData.success(
          res,
          messageConstants.OTP_SENT || 'OTP sent successfully'
        );
      }

      return responseData.fail(res, messageConstants.INVALID_LOGIN_TYPE || 'Invalid login type', 400);
    } catch (err) {
      logger.error(messageConstants.INTERNAL_SERVER_ERROR, err);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};

const verifyOtp = async (body, res) => {
  return new Promise(async () => {
    try {
      const { countryCode, phone, otp } = body;

      if (!countryCode || !phone || !otp) {
        return responseData.fail(res, messageConstants.PHONE_OTP_REQUIRED || 'Phone & OTP required', 400);
      }

      const phoneForDb = String(phone).trim();
      const user = await UserSchema.findOne({ phone: phoneForDb, countryCode, is_deleted: false });

      if (!user || !user.otp || !user.otpExpiresAt) {
        return responseData.fail(res, messageConstants.INVALID_OTP || 'Invalid or expired OTP', 401);
      }

      if (Date.now() > user.otpExpiresAt) {
        user.otp = null;
        user.otpExpiresAt = null;
        await user.save();
        return responseData.fail(res, messageConstants.INVALID_OTP || 'Invalid or expired OTP', 401);
      }

      if (String(otp).trim() !== String(user.otp).trim()) {
        return responseData.fail(res, messageConstants.INVALID_OTP || 'Invalid or expired OTP', 401);
      }

      // OTP valid → clear it
      user.otp = null;
      user.otpExpiresAt = null;
      await createJsonWebTokenForUser(user);
      await user.save();

      logger.info(`User ${countryCode}${phoneForDb} verified OTP and logged in`);
      return responseData.success(res, user, messageConstants.LOGGEDIN_SUCCESSFULLY);
    } catch (err) {
      logger.error(messageConstants.INTERNAL_SERVER_ERROR, err);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};

const createJsonWebTokenForUser = async (user) => {
  user['token'] = await jsonWebToken.createToken(user['_id']);
  await UserSchema.updateOne(
    { _id: user['_id'] },
    { $set: { token: user['token'], updated_at: new Date() } }
  );
  delete user?._doc?.password;
};

const OTP_STORE = new Map();


// const genOtp = () =>
//   otpGenerator.generate(6, { digits: true, upperCase: false, specialChars: false, alphabets: false });
const genOtp = () =>
  otpGenerator.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false
  });

// otpGenerator.generate(6, { digits: true, upperCase: false, specialChars: false, alphabets: false });


const last10Digits = (phoneLike) => {
  const digits = String(phoneLike).replace(/\D/g, '');
  return digits.slice(-10);
};

const logout = async (body, res) => {
  return new Promise(async () => {
    try {
      const userId = body?.userId || null;

      logger.info(`User ${userId || ""} logged out successfully`);

      return responseData.success(
        res,
        {},
        messageConstants.LOGGED_OUT_SUCCESSFULLY || "Logged out successfully"
      );
    } catch (err) {
      logger.error("Logout failed", err);
      return responseData.fail(
        res,
        messageConstants.INTERNAL_SERVER_ERROR,
        500
      );
    }
  });
};

const forgotPassword = async (req, res, next) => {
  return new Promise(async () => {
    const user = await UserSchema.findOne({ email_id: req.body.email_id })
    if (user) {
      if (user.token) {
        await jsonWebToken.validateToken(req, res, next, user.token)
      } else {
        await createJsonWebTokenForUser(user);
      }
      await forgotPasswordLink(res, user);
    } else {
      logger.error(messageConstants.USER_NOT_FOUND);
      return responseData.fail(res, messageConstants.USER_NOT_FOUND, 404)
    }
  })
}

const changePassword = async (body, user, res) => {
  return new Promise(async () => {
    try {
      const newPass = await cryptoGraphy.hashPassword(body.newPassword);
      const result = await UserSchema.findOneAndUpdate(
        { _id: user._id },
        {
          password: newPass,
          isPasswordChanged: false   // ✅ update the flag
        },
        { new: true } // ✅ returns updated doc instead of old one)
      );
      if (result.length !== 0) {
        const mailContent = {
          first_name: user.first_name,
          last_name: user.last_name
        }
        // await mail.sendMailToUser(mailTemplateConstants.FORGOTTED_PASS_TEMPLATE, user.email_id, mailSubjectConstants.FORGOTTED_PASS_SUBJECT, res, mailContent);
        logger.info(`${messageConstants.CHANGE_PASSWORD} for ${user.email_id}`);
        return responseData.success(res, {}, messageConstants.CHANGE_PASSWORD);
      } else {
        logger.error(`${messageConstants.CHANGE_PASSWORD_FAILED} for ${user.email_id}`);
        return responseData.fail(res, messageConstants.CHANGE_PASSWORD_FAILED, 403)
      }
    } catch (error) {
      logger.error(`${messageConstants.CHANGE_PASSWORD_FAILED} for ${user.email_id}`);
      return responseData.fail(res, messageConstants.CHANGE_PASSWORD_FAILED, 403)
    }

  })
}

const resetPassword = async (body, userData, res) => {
  return new Promise(async () => {
    body['old_password'] = cryptoGraphy.encrypt(body.old_password);
    const user = await UserSchema.findOne({ _id: userData._id })
    if (body.old_password !== user.password) {
      logger.error(`${messageConstants.OLD_PASSWORD_NOT_MATCHED} with ${body.old_password}`);
      return responseData.fail(res, messageConstants.OLD_PASSWORD_NOT_MATCHED, 403)
    } else {
      body['new_password'] = cryptoGraphy.encrypt(body.new_password);
      await UserSchema.findOneAndUpdate(
        { _id: user._id },
        { password: body['new_password'] }
      ).then(async (result) => {
        if (result.length !== 0) {
          const mailContent = {
            first_name: user.first_name,
            last_name: user.last_name
          }
          // await mail.sendMailToUser(mailTemplateConstants.RESET_PASS_TEMPLATE, user.email, mailSubjectConstants.RESET_PASS_SUBJECT, res, mailContent);
          logger.info(`${messageConstants.PASSWORD_RESET} for ${user.email_id}`);
          return responseData.success(res, {}, messageConstants.PASSWORD_RESET);
        } else {
          logger.error(`${messageConstants.PASSWORD_NOT_RESET} for ${user.email_id}`);
          return responseData.fail(res, messageConstants.PASSWORD_NOT_RESET, 403)
        }
      })
    }
  })
}
module.exports = {
  signUp,
  signIn,
  verifyOtp,
  logout,
  changePassword,
  forgotPassword,
  resetPassword
}