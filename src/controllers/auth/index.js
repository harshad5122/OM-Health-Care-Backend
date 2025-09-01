const authService = require('../../services/auth');
const { logger } = require('../../utils');
const { messageConstants } = require('../../constants');

const signUp = async (req, res) => {
    try {
        const response = await authService.signUp(req.body, res);
        logger.info(`${messageConstants.RESPONSE_FROM} signup API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Signup ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}


const signIn = async (req, res) => {
    try {
        const response = await authService.signIn(req.body, res);
        logger.info(`${messageConstants.RESPONSE_FROM} signIn API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`signIn ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const logout = async (req, res) => {
    try {
        const response = await authService.logout(req.body, res);
        logger.info(`${messageConstants.RESPONSE_FROM} logout API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`logout ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

module.exports = {
    signUp,
    signIn,
    logout
}