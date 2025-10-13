const mongoose = require("mongoose");
const Appointment = require("../models/appointment"); // adjust path if needed
const moment = require("moment");
/**
 * Generate daily appointment trend data for ECharts
 * - xAxis: list of unique dates (e.g. ['2025-10-01', '2025-10-02', ...])
 * - legend: statuses (e.g. ['CONFIRMED', 'CANCELLED', ...])
 * - series: one bar series per status with daily counts
 */
const generateDailyApptTrend = async () => {
  try {
    // Step 1: Aggregate by DATE (not month) and status
    const data = await Appointment.aggregate([
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": 1 }
      }
    ]);
    if (!data.length) {
      return { xAxis: [], legend: [], series: [] };
    }
    // Step 2: Collect unique dates (xAxis) and statuses (legend)
    const datesSet = new Set();
    const statusSet = new Set();
    data.forEach(item => {
      datesSet.add(item._id.date);
      statusSet.add(item._id.status);
    });
    const dates = Array.from(datesSet).sort();
    const statuses = Array.from(statusSet);
    // Step 3: Build series array
    const series = statuses.map(status => {
      const dataPoints = dates.map(date => {
        const found = data.find(
          d => d._id.date === date && d._id.status === status
        );
        return found ? found.count : 0;
      });
      return {
        name: status,
        type: "bar",
        stack: "total",
        emphasis: { focus: "series" },
        data: dataPoints
      };
    });
    return {
      xAxis: dates,
      legend: statuses,
      series
    };
  } catch (err) {
    console.error("Error generating daily appointment trend:", err);
    return { xAxis: [], legend: [], series: [] };
  }
};
module.exports = {
  generateDailyApptTrend
};
