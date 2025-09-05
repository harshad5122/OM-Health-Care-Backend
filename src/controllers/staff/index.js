const staffService = require('../../services/staff');
const { messageConstants } = require('../../constants');
const { logger } = require('../../utils');

const addDoctor = async (req, res) => {
    try {
        const response = await staffService.addDoctor(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} add Doctor API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`add Doctor ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const getDoctor = async (req, res) => {
    try {
        const response = await staffService.getDoctor(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} add Doctor API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`get Doctor ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const editDoctor = async (req, res) => {
    try {
        const response = await staffService.editDoctor(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} edit Doctor API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`edit Doctor ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const deleteDoctor = async (req, res) => {
    try {
        const response = await staffService.deleteDoctor(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} delete Doctor API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`delete Doctor ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const getDoctorById = async (req, res) => {
    try {
        const response = await staffService.getDoctorById(req, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get doctor API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`get doctor API ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}


module.exports = {
    addDoctor,
    getDoctor,
    editDoctor,
    deleteDoctor,
    getDoctorById
}