const authController = require('../../controllers/auth');
const { jsonWebToken, authValidator } = require('../../middlewares');
const { urlConstants } = require('../../constants');

module.exports = (app) => {
    app.post(urlConstants.USER_SIGNUP, authValidator.signUpValidation, authController.signUp);
    app.post(urlConstants.USER_SIGNIN, authController.signIn);

};