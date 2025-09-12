const  leaveServise = require('../../services/leave')

const createLeave = async (req, res) => {
    try {
        const response = await leaveServise?.createLeave(req, res)
        logger.info(`${messageConstants.RESPONSE_FROM} create leave`, JSON.stringify(response));
        res.send(response);

    } catch (err) {
        logger.error(`create leave ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

module.exports = {
    createLeave
}