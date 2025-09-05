const userController = require('../../controllers/user');
const { jsonWebToken } = require('../../middlewares');
const { urlConstants } = require('../../constants');

module.exports = (app) => {
    app.get(urlConstants.GET_ADMIN_LIST, jsonWebToken.validateToken, userController.getAdminList);
    app.get(urlConstants.GET_STAFF_LIST, jsonWebToken.validateToken, userController.getStaffList);
    app.get(urlConstants.GET_USER_LIST, jsonWebToken.validateToken, userController.getUserList);
    app.get(urlConstants.GET_USER_PROFILE, jsonWebToken.validateToken, userController.getUserProfile);
    app.put(urlConstants.UPDATE_USER_PROFILE, jsonWebToken.validateToken, userController.updateUserProfile);
    app.put(urlConstants.EDIT_USER, jsonWebToken.validateToken, userController.editUser);
    app.delete(urlConstants.DELETE_USER, jsonWebToken.validateToken, userController.deleteUser);
    app.post(urlConstants.USER_ADD, jsonWebToken.validateToken, userController?.createUser);
    app.get(urlConstants.GET_USER_BY_ID, jsonWebToken.validateToken, userController.getUserProfile)
}