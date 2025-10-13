const { generateDailyApptTrend } = require("../../utils/helper");
const getChartData = async (req, res) => {
    return new Promise(async () => {
        try {
            if (req?.body?.chartName === "monthly_appointmnet_terend") {
                const chartData = await generateDailyApptTrend();
                return res.json({
                    success: true,
                    data: chartData
                });
            } else {
                return res.json({ success: false, message: "Unknown chartName" });
            }
        } catch (err) {
            console.error("Error in getChartData:", err);
            return res.status(500).json({ success: false, error: "Server error" });
        }
    })
}
module.exports = {
    getChartData
}






