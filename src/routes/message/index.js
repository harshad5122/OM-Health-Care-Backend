const messageController = require('../../controllers/message');
const { jsonWebToken } = require('../../middlewares');
const { urlConstants } = require('../../constants');

module.exports = (app) => {
    // app.post(urlConstants.SEND_MESSAGE, jsonWebToken.validateToken, messageController.sendMessage);
    // app.get(urlConstants.GET_MESSAGE, jsonWebToken.validateToken, messageController.getMessage);
    app.get(urlConstants.MESSAGE_LIST, jsonWebToken.validateToken, messageController.getMessageList);
    app.get(urlConstants.CHAT_LIST, jsonWebToken.validateToken, messageController.getChatList);
    app.get(urlConstants.GROUP_MESSAGE_LIST, jsonWebToken.validateToken, messageController.getGroupMessageList);
    app.get(urlConstants.GET_BROADCASTS, jsonWebToken.validateToken, messageController.getBroadcastList);
    app.get(urlConstants.GET_BROADCAST_RECIPIENTS, jsonWebToken.validateToken, messageController.getBroadcastRecipients);

}