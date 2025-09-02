const staffController = require('../../controllers/staff');
const { jsonWebToken } = require('../../middlewares');
const { urlConstants } = require('../../constants');

module.exports = (app) => {
    app.post(urlConstants.ADD_DOCTOR, jsonWebToken.validateToken, staffController.addDoctor);
    app.get(urlConstants.GET_DOCTOR, jsonWebToken.validateToken, staffController.getDoctor);
    app.put(urlConstants.EDIT_DOCTOR, jsonWebToken.validateToken, staffController.editDoctor);
    app.delete(urlConstants.DELETE_DOCTOR, jsonWebToken.validateToken, staffController.deleteDoctor);
};