const dashboardServise = require('../../services/dashboard')
const getChartsData = async (req, res) => {
    try {
        const response = await dashboardServise?.getChartData(req, res)
        res.send(response);
    } catch (err) {
        logger.error(`Signup ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}
module.exports = {
    getChartsData
}