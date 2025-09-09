const notificationService = require('../../services/notification')



const getNotification = async (req, res) => {
    try {
        const response = await notificationService?.getNotifications(req, res)
        logger.info(`${messageConstants.RESPONSE_FROM} get notification API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Patient ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

module.exports = {
    getNotification
}