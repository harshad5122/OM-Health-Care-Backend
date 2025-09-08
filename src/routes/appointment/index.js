const { jsonWebToken } = require('../../middlewares');
const { urlConstants } = require('../../constants');
const appointmentController = require('../../controllers/appointment')

module.exports = (app) => {
    app.post(urlConstants.CREATE_APPPOINTMENT, jsonWebToken.validateToken, appointmentController.createAppointment)
}