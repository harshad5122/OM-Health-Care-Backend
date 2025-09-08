const appointmentService = require('../../services/appointment')


const createAppointment = async (req, res) => {
    try {
        const response = await appointmentService?.createAppointment(req, res);
        logger.info(`${messageConstants.RESPONSE_FROM} create appointment API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Book Appointment ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}


module.exports = {
    createAppointment
}