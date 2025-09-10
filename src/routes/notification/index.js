
const { urlConstants } = require('../../constants')
const notificationController = require('../../controllers/notification')
const { jsonWebToken } = require('../../middlewares')

module.exports = (app) => {

    app.get(urlConstants?.GET_NOTIFICATION, jsonWebToken.validateToken, notificationController?.getNotification)
    app.get(urlConstants?.MAEK_SEEN, jsonWebToken.validateToken, notificationController?.markAsSeen)
}