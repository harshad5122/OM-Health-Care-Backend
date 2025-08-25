// socket/index.js
const chatSocket = require('./chat');
// const notificationSocket = require('./notification');

class SocketManager {
    static notificationHandler = null;

    static init(io) {
    //     this.notificationHandler = notificationSocket(io);
        chatSocket(io);
    }

    static getNotificationHandler() {
        return this.notificationHandler;
    }
}

module.exports = (io) => SocketManager.init(io);
module.exports.getNotificationHandler = () => SocketManager.getNotificationHandler();