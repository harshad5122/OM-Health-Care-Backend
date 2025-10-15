const {
	generateDailyApptTrend,
	generateApptStatusPie,
	generatePatientStatusChart,
	getDashboardTotals,
    getTodaysStaffLeaves,
	getAvailableDoctorsToday,
	generateStaffLeavePie
} = require('../../utils/helper');

const getChartData = async (req, res) => {
	try {
		const { chartName, filter,skip = 0, limit = 10 } = req.body;

		if (chartName === 'appointmnet_trend_by_status') {
			const chartData = await generateDailyApptTrend(filter);
			return res.json({ success: true, data: chartData });
		} else if (chartName === 'appointment_status') {
			const chartData = await generateApptStatusPie(filter);
			return res.json({ success: true, data: chartData });
		} else if (chartName === 'patient_status') {
			const chartData = await generatePatientStatusChart(filter);
			return res.json({ success: true, data: chartData });
		} else if (chartName === 'dashboard_totals') {
			const totals = await getDashboardTotals(filter);
			return res.json({ success: true, data: totals });
		}  else if (chartName === 'todays_staff_leaves') {
			// const leaves = await getTodaysStaffLeaves();
			// return res.json({ success: true, data: leaves });
			const leaves = await getTodaysStaffLeaves(Number(skip), Number(limit));
			return res.json({ success: true, ...leaves });
		}else if (chartName === 'todays_staff_available') {
			// const leaves = await getAvailableDoctorsToday();
			// return res.json({ success: true, data: leaves });
			const doctors = await getAvailableDoctorsToday(Number(skip), Number(limit));
      		return res.json({ success: true, ...doctors });
		}
		else if (chartName === 'doctor_leaves') {
			const doctorleaves = await generateStaffLeavePie(filter);
			return res.json({ success: true, data: doctorleaves });
		}else {
			return res.json({ success: false, message: 'Unknown chartName' });
		}
	} catch (err) {
		console.error('Error in getChartData:', err);
		return res.status(500).json({ success: false, error: 'Server error' });
	}
};
module.exports = {
	getChartData,
};
