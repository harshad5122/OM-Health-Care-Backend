const dashboardController = require('../../controllers/dashboard')
const { jsonWebToken, authValidator } = require('../../middlewares');
const { urlConstants } = require('../../constants');
module.exports = (app) => {
    app.post(urlConstants.GET_CHARTS_DATA, jsonWebToken.validateToken, dashboardController?.getChartsData);
};