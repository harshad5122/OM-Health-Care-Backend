const userService = require('../../services/user');
const { messageConstants } = require('../../constants');
const { logger } = require('../../utils');

const getAdminList = async (req, res) => {
    try {
        const response = await userService.getAdminList(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get admin list API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Admin list ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const getStaffList = async (req, res) => {
    try {
        const response = await userService.getStaffList(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get staff list API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Staff list ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const getUserList = async (req, res) => {
    try {
        const response = await userService.getUserList(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get user list API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Staff list ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}


const getUserProfile = async (req, res) => {
    try {
        const response = await userService.getUserProfile(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get user profile API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Staff list ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const updateUserProfile = async (req, res) => {
    try {
        const response = await userService.updateUserProfile(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} update user profile API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Staff list ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

module.exports = {
    getAdminList,
    getStaffList,
    getUserList,
    getUserProfile,
    updateUserProfile,
}