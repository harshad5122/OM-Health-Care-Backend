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
const getAppontmentByDoctor = async (req, res) => {
    try {
        const response = await appointmentService?.getAppontmentByDoctor(req, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get appointment API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Appointment ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const getPatients = async (req, res) => {
    try {
        const response = await appointmentService?.getPatients(req, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get patients API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Patient ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

module.exports = {
    createAppointment,
    getAppontmentByDoctor,
    getPatients
}