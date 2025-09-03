const authController = require('../../controllers/auth');
const { jsonWebToken, authValidator } = require('../../middlewares');
const { urlConstants } = require('../../constants');

module.exports = (app) => {
    app.post(urlConstants.USER_SIGNUP, authValidator.signUpValidation, authController.signUp);
    app.post(urlConstants.USER_SIGNIN, authController.signIn);
    app.post(urlConstants.USER_LOGOUT, jsonWebToken.validateToken, authController.logout);
    app.post(urlConstants.USER_CHANGE, jsonWebToken.validateToken, authController.changePassword);
};