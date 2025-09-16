const { jsonWebToken } = require('../../middlewares');
const { urlConstants } = require('../../constants');
const appointmentController = require('../../controllers/appointment')

module.exports = (app) => {
    app.post(urlConstants.CREATE_APPPOINTMENT, jsonWebToken.validateToken, appointmentController.createAppointment)
    app.get(urlConstants.GET_APPOINTMENT_BY_DOCTOR, jsonWebToken.validateToken, appointmentController?.getAppontmentByDoctor)
    app.get(urlConstants.GET_APPOINTMENT_LIST, jsonWebToken.validateToken, appointmentController?.getAppointmentList)
    app.get(urlConstants?.GET_PATIENTS, jsonWebToken.validateToken, appointmentController?.getPatients)
    app.put(urlConstants?.UPDATE_APPOINTMENT_STATUS, jsonWebToken.validateToken, appointmentController?.updateAppointmentStatus)
    app.put(urlConstants?.UPDATE_APPOINTMENT, jsonWebToken.validateToken, appointmentController?.updateAppointment)
}