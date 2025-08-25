const roomController = require('../../controllers/room');
const { jsonWebToken } = require('../../middlewares');
const { urlConstants } = require('../../constants');

module.exports = (app) => {
    app.post(urlConstants.CREATE_ROOM, jsonWebToken.validateToken, roomController.createRoom);
    app.put(urlConstants.UPDATE_ROOM, jsonWebToken.validateToken, roomController.updateRoom);
    app.post(urlConstants.CREATE_ADMIN, jsonWebToken.validateToken, roomController.createAdmin);
    app.put(urlConstants.REMOVE_ADMIN, jsonWebToken.validateToken, roomController.removeAdmin);
    app.get(urlConstants.GET_ROOM_MEMBERS, jsonWebToken.validateToken, roomController.getRoomMembers);
}