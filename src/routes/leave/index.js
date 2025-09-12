const { jsonWebToken } = require('../../middlewares');
const { urlConstants } = require('../../constants');
const leaveController = require('../../controllers/leave')

module.exports = (app) => {
    app.post(urlConstants.CREATE_LEAVE, jsonWebToken.validateToken,leaveController?.createLeave)
    app.get(urlConstants.GET_LEAVE_BY_DOCTOR, jsonWebToken.validateToken,leaveController?.getLeaveByDoctor)
    
}