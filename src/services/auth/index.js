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

      // ----------------- LOGIN WITH PHONE (OTP) -----------------
      if (loginType === 'phone') {

        const { countryCode, phone, otp } = body;

        if (!countryCode || !phone) {
          return responseData.fail(res, messageConstants.PHONE_REQUIRED, 400);
        }

     
        const fullPhone = `${String(countryCode).trim()}${String(phone).trim()}`;

   
        if (!otp) {
    
          const generated = genOtp();

        
          OTP_STORE.set(fullPhone, { otp: generated, expires: Date.now() + 5 * 60 * 1000 });
          logger.info(`OTP for ${fullPhone} is: ${generated} (valid 5 min)`);

          return responseData.success(
            res,
            { phone: fullPhone },
            messageConstants.OTP_SENT || 'OTP sent successfully'
          );
        }

        // STEP 2: Verify OTP
        const entry = OTP_STORE.get(fullPhone);
        if (!entry) {
          return responseData.fail(res, messageConstants.INVALID_OTP || 'Invalid or expired OTP', 401);
        }
        const { otp: storedOtp, expires } = entry;

        if (Date.now() > expires) {
          OTP_STORE.delete(fullPhone);
          return responseData.fail(res, messageConstants.INVALID_OTP || 'Invalid or expired OTP', 401);
        }

        if (String(otp).trim() !== String(storedOtp).trim()) {
          return responseData.fail(res, messageConstants.INVALID_OTP || 'Invalid or expired OTP', 401);
        }

        OTP_STORE.delete(fullPhone);
        const phoneForDb = last10Digits(fullPhone);

        let user = await UserSchema.findOne({ phone: phoneForDb, is_deleted: false });
        if (!user) {
          user = new UserSchema({ phone: phoneForDb });
          await user.save();
        }

        await createJsonWebTokenForUser(user);
        logger.info(`User ${fullPhone} logged in with phone`);
        return responseData.success(res, user, messageConstants.LOGGEDIN_SUCCESSFULLY);
      }

      return responseData.fail(res, messageConstants.INVALID_LOGIN_TYPE || 'Invalid login type', 400);
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


module.exports = {
    signUp,
    signIn,
    logout
}