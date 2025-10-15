const mongoose = require('mongoose');
const Appointment = require('../models/appointment');
const moment = require('moment');
const User = require('../models/user');
const { UserTypes } = require('../constants');
const StaffLeave = require("../models/staff_leave");
const Staff = require("../models/staff");

const generateDailyApptTrend = async (filter = {}) => {
	try {
		const matchStage = {};

		if (filter.from && filter.to) {
			matchStage.date = {
				$gte: new Date(filter.from),
				$lte: new Date(filter.to),
			};
		}

		const data = await Appointment.aggregate([
			{ $match: matchStage },
			{
				$group: {
					_id: {
						date: {
							$dateToString: {
								format: '%Y-%m-%d',
								date: '$date',
							},
						},
						status: '$status',
					},
					count: { $sum: 1 },
				},
			},
			{ $sort: { '_id.date': 1 } },
		]);

		if (!data.length) return { xAxis: [], legend: [], series: [] };

		const datesSet = new Set();
		const statusSet = new Set();
		data.forEach((item) => {
			datesSet.add(item._id.date);
			statusSet.add(item._id.status);
		});
		const dates = Array.from(datesSet).sort();
		const statuses = Array.from(statusSet);

		const series = statuses.map((status) => {
			const dataPoints = dates.map((date) => {
				const found = data.find(
					(d) => d._id.date === date && d._id.status === status,
				);
				return found ? found.count : 0;
			});
			return {
				name: status,
				type: 'bar',
				stack: 'total',
				emphasis: { focus: 'series' },
				data: dataPoints,
			};
		});

		return { xAxis: dates, legend: statuses, series };
	} catch (err) {
		console.error('Error generating daily appointment trend:', err);
		return { xAxis: [], legend: [], series: [] };
	}
};

const generateApptStatusPie = async (filter = {}) => {
	try {
		const matchStage = {};
		if (filter.from && filter.to) {
			matchStage.date = {
				$gte: new Date(filter.from),
				$lte: new Date(filter.to),
			};
		}

		const data = await Appointment.aggregate([
			{ $match: matchStage },
			{ $group: { _id: '$status', count: { $sum: 1 } } },
		]);

		if (!data.length) return { series: [] };

		const pieData = data.map((item) => ({
			name: item._id,
			value: item.count,
		}));

		return {
			series: [
				{
					name: 'Appointments',
					type: 'pie',
					radius: '50%',
					data: pieData,
					emphasis: {
						itemStyle: {
							shadowBlur: 10,
							shadowOffsetX: 0,
							shadowColor: 'rgba(0, 0, 0, 0.5)',
						},
					},
				},
			],
		};
	} catch (err) {
		console.error('Error generating appointment status pie chart:', err);
		return { series: [] };
	}
};



// const generatePatientStatusChart = async (filter = {}) => {
//     try {
//         const matchStage = {};

//         // Filter by date if provided
//         if (filter.from && filter.to) {
//             matchStage.date = {
//                 $gte: new Date(filter.from),
//                 $lte: new Date(filter.to),
//             };
//         }

//         const data = await Appointment.aggregate([
//             { $match: matchStage },
//             // Join with users to get assign_doctor
//             {
//                 $lookup: {
//                     from: 'users',
//                     localField: 'patient_id',
//                     foreignField: '_id',
//                     as: 'patient',
//                 },
//             },
//             { $unwind: '$patient' },
//             // Match appointments where staff_id == patient.assign_doctor
//             {
//                 $match: { $expr: { $eq: ['$staff_id', '$patient.assign_doctor'] } }
//             },
//             // Keep only one record per patient to avoid double counting
//             {
//                 $group: {
//                     _id: '$patient_id',
//                     patient_status: { $first: '$patient_status' } // take one patient_status
//                 }
//             },
//             // Group by patient_status to count
//             {
//                 $group: {
//                     _id: '$patient_status',
//                     count: { $sum: 1 }
//                 }
//             },
//             { $sort: { _id: 1 } }
//         ]);

//         if (!data.length) return { xAxis: [], legend: [], series: [] };

//         const xAxis = data.map((item) => item._id);
//         const counts = data.map((item) => item.count);

//         const series = [
//             {
//                 name: 'Patients',
//                 type: 'bar',
//                 data: counts,
//                 emphasis: { focus: 'series' },
//             },
//         ];

//         return { xAxis, legend: ['Patients'], series };
//     } catch (err) {
//         console.error('Error generating patient status chart:', err);
//         return { xAxis: [], legend: [], series: [] };
//     }
// };


const generatePatientStatusChart = async (filter = {}) => {
    try {
        const matchStage = {};

        // Filter by date if provided
        if (filter.from && filter.to) {
            matchStage.date = {
                $gte: new Date(filter.from),
                $lte: new Date(filter.to),
            };
        }

        // 1. Count total patients
        const userMatch = { is_deleted: false, role: UserTypes.USER };
        if (filter.from && filter.to) {
            userMatch.created_at = {
                $gte: new Date(filter.from),
                $lte: new Date(filter.to),
            };
        }
        const totalPatients = await User.countDocuments(userMatch);

        // 2. Aggregate patients with a status
        const data = await Appointment.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'users',
                    localField: 'patient_id',
                    foreignField: '_id',
                    as: 'patient',
                },
            },
            { $unwind: '$patient' },
            { $match: { $expr: { $eq: ['$staff_id', '$patient.assign_doctor'] } } },
            {
                $group: {
                    _id: '$patient_id',
                    patient_status: { $first: '$patient_status' }
                }
            },
            {
                $group: {
                    _id: '$patient_status',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 3. Calculate total patients with status
        const totalWithStatus = data.reduce((sum, item) => sum + item.count, 0);

        // 4. Add "No Status" entry
        const noStatusCount = totalPatients - totalWithStatus;
        if (noStatusCount > 0) {
            data.push({ _id: 'No Status', count: noStatusCount });
        }

        // 5. Prepare chart data
        if (!data.length) return { xAxis: [], legend: [], series: [] };

        const xAxis = data.map((item) => item._id);
        const counts = data.map((item) => item.count);

        const series = [
            {
                name: 'Patients',
                type: 'bar',
                data: counts,
                emphasis: { focus: 'series' },
            },
        ];

        return { xAxis, legend: ['Patients'], series };
    } catch (err) {
        console.error('Error generating patient status chart:', err);
        return { xAxis: [], legend: [], series: [] };
    }
};




const getDashboardTotals = async (filter = {}) => {
  try {

    const appointmentMatch = { status: 'COMPLETED' };
    if (filter.from && filter.to) {
      appointmentMatch.date = {
        $gte: new Date(filter.from),
        $lte: new Date(filter.to),
      };
    }

    const totalAppointments = await Appointment.countDocuments(appointmentMatch);

    const userMatch = { is_deleted: false, role: UserTypes.USER };
    if (filter.from && filter.to) {
      userMatch.created_at = {
        $gte: new Date(filter.from),
        $lte: new Date(filter.to),
      };
    }

    const totalPatients = await User.countDocuments(userMatch);
	// const totalPatients = await User.countDocuments({is_deleted: false,
    //   role: UserTypes.USER});

    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();
    const newPatients = await User.countDocuments({
      is_deleted: false,
      role: UserTypes.USER,
      created_at: { $gte: startOfMonth, $lte: endOfMonth },
    });


	const doctorMatch = { is_deleted: false };
    // if (filter.from && filter.to) {
    //   doctorMatch.created_at = {
    //     $gte: new Date(filter.from),
    //     $lte: new Date(filter.to),
    //   };
    // }

    const totalDoctors = await Staff.countDocuments(doctorMatch);

    return {
      totalAppointments,
      totalPatients,
      newPatients,
	  totalDoctors
    };
  } catch (err) {
    console.error('Error in getDashboardTotals:', err);
    return {
      totalAppointments: 0,
      totalPatients: 0,
      newPatients: 0,
	   totalDoctors:0
    };
  }
};

const getTodaysStaffLeaves = async (skip = 0, limit = 10) => {
  try {
    const today = moment().startOf('day').toDate();

    // Get total count first
    const totalCount = await StaffLeave.countDocuments({
      start_date: { $lte: today },
      end_date: { $gte: today },
      status: "CONFIRMED",
    });

    // Fetch paginated leaves
    const leaves = await StaffLeave.find({
      start_date: { $lte: today },
      end_date: { $gte: today },
      status: "CONFIRMED",
    })
      .populate('staff_id', 'firstname lastname')
      .skip(skip)
      .limit(limit)
      .lean();

    const data = leaves.map((leave) => {
      const staff = leave.staff_id;
      return {
        staffName: staff ? `${staff.firstname} ${staff.lastname}` : 'Unknown Staff',
        leaveType: leave.leave_type || 'N/A',
        status: leave.status || 'N/A',
        startDate: leave.start_date || null,
        endDate: leave.end_date || null,
      };
    });

    return { totalCount, data };
  } catch (err) {
    console.error('Error fetching today staff leaves:', err);
    return { totalCount: 0, data: [] };
  }
};

const getAvailableDoctorsToday = async (skip = 0, limit = 10) => {
  try {
    const today = moment().startOf('day').toDate();

    // Step 1: Fetch all active doctors
    const allDoctors = await Staff.find({ is_deleted: false }).lean();

    // Step 2: Fetch today's confirmed leaves
    const todaysLeaves = await StaffLeave.find({
      start_date: { $lte: today },
      end_date: { $gte: today },
      status: "CONFIRMED"
    })
      .populate('staff_id', 'firstname lastname')
      .lean();

    // Step 3: Build leave map
    const leaveMap = new Map();
    todaysLeaves.forEach((leave) => {
      const staffId = leave.staff_id?._id?.toString();
      if (staffId) {
        leaveMap.set(staffId, leave.leave_type);
      }
    });

    // Step 4: Prepare doctor availability data
    const availableDoctors = allDoctors.map((doctor) => {
      const docId = doctor._id.toString();
      const leaveType = leaveMap.get(docId);

      let availableTime = 'Full Day';
      if (leaveType === 'FIRST_HALF') availableTime = 'Second Half';
      else if (leaveType === 'SECOND_HALF') availableTime = 'First Half';
      else if (leaveType === 'FULL_DAY') availableTime = 'Not Available';

      return {
        doctorName: `${doctor.firstname} ${doctor.lastname}`,
        availableTime,
      };
    });

    // Step 5: Filter out full-day leaves
    const filteredDoctors = availableDoctors.filter(d => d.availableTime !== 'Not Available');

    // Step 6: Paginate
    const totalCount = filteredDoctors.length;
    const data = filteredDoctors.slice(skip, skip + limit);

    return { totalCount, data };
  } catch (err) {
    console.error("Error fetching available doctors today:", err);
    return { totalCount: 0, data: [] };
  }
};

const generateStaffLeavePie = async (filter = {}) => {
  try {
    const matchStage = {};
    
    // Apply date filters if provided
    if (filter.from && filter.to) {
      matchStage.start_date = { $gte: new Date(filter.from) };
      matchStage.end_date = { $lte: new Date(filter.to) };
    }

    // Fetch leave counts grouped by status
    const data = await StaffLeave.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    if (!data.length) return { series: [] };

    const pieData = data.map((item) => ({
      name: item._id,
      value: item.count,
    }));

    return {
      series: [
        {
          name: 'Staff Leaves',
          type: 'pie',
          radius: '50%',
          data: pieData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  } catch (err) {
    console.error('Error generating staff leave pie chart:', err);
    return { series: [] };
  }
};

module.exports = {
	generateDailyApptTrend,
	generateApptStatusPie,
	generatePatientStatusChart,
	getDashboardTotals,
	getTodaysStaffLeaves,
	getAvailableDoctorsToday,
	generateStaffLeavePie
};
