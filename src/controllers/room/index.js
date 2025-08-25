const roomService = require('../../services/room');
const { messageConstants } = require('../../constants');
const { logger } = require('../../utils');

const createRoom = async (req, res) => {
    try {
        const response = await roomService.createRoom(req.body, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} create room API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Create room ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const updateRoom = async (req, res) => {
    try {
        const response = await roomService.updateRoom(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} update room API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Update room ${messageConstants.API_FAILED}`, err);
        res.send(err);        
    }
} 

const createAdmin = async (req, res) => {
    try {
        const response = await roomService.createAdmin(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} create admin API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`create admin ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const removeAdmin = async (req, res) => {
    try {
        const response = await roomService.removeAdmin(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} remove admin API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`remove admin ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const getRoomMembers = async (req, res) => {
    try {
        const response = await roomService.getRoomMembers(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get room members API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`get room members admin ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}


module.exports = {
    createRoom,
    updateRoom,
    createAdmin,
    removeAdmin,
    getRoomMembers
}