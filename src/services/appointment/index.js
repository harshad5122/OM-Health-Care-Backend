const { UserRole } = require('../../constants');
const { AppointmentStatus, NotificationType, leaveTypeTimes, PatientStatus } = require('../../constants/enum');
const AppointmentSchema = require('../../models/appointment');
const WeeklyScheduleSchema = require('../../models/weekly_schedule_pattern');
const UserSchema = require('../../models/user');
const StaffSchema = require('../../models/staff');
const { logger, mail } = require('../../utils');
const { responseData, messageConstants, mailTemplateConstants, mailSubjectConstants } = require('../../constants');
const moment = require("moment");
const StaffLeaveSchema = require('../../models/staff_leave')
const NotificationSchema = require('../../models/notification')
const SocketSchema = require('../../models/socket')
const { UserTypes } = require('../../constants');
const mongoose = require("mongoose");

const createAppointment = async (req, res) => {
    return new Promise(async () => {
        try {
            const { patient_id, staff_id, date, time_slot, visit_type, patient_name } = req?.body
            const userDetails = req.userDetails

            const payload = {
                patient_id,
                staff_id,
                date,
                time_slot,
                visit_type,
                created_by: userDetails?.role == UserRole.ADMIN ? "ADMIN" : "DOCTOR",
                status: AppointmentStatus?.CONFIRMED,
                patient_status: PatientStatus.CONTINUE,
                creator: userDetails?._id
            }
            // const appointment = await AppointmentSchema?.create({ ...payload });
            const appointment = await AppointmentSchema.create(payload);
            const user = await UserSchema?.findOne({ staff_id });

            const appointmentDate = new Date(date);
            const formattedDate = `${String(appointmentDate.getDate()).padStart(2, '0')}/${String(appointmentDate.getMonth() + 1).padStart(2, '0')}/${appointmentDate.getFullYear()}`;
            const formatTimeTo12Hour = (timeString) => {
                const [hours, minutes] = timeString.split(':');
                const hour = parseInt(hours);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const twelveHour = hour % 12 || 12;
                return `${twelveHour}:${minutes} ${ampm}`;
            };
            const formattedStartTime = formatTimeTo12Hour(time_slot?.start);
            const formattedEndTime = formatTimeTo12Hour(time_slot?.end);

             const message = `Your appointment on ${formattedDate} (${formattedStartTime} - ${formattedEndTime}) has been confirmed.`;
             const patient = await UserSchema.findById(patient_id);
             const admins = await UserSchema.find({ role: UserRole.ADMIN });

             const io = req.app.get('socketio');
            const notifications = [];

            // 🔹 Notify patient
      if (patient) {
        const notif = await NotificationSchema.create({
          sender_id: userDetails?._id,
          receiver_id: patient._id,
          type: NotificationType.APPOINTMENT_CONFIRMED,
          message,
          reference_id: appointment._id,
          reference_model: "Appointment",
          read: false
        });
        notifications.push(notif);

        // send via socket
        const patientSocket = await SocketSchema.findOne({ user_id: patient._id });
        if (patientSocket && patientSocket.socket_id && io) {
          io.to(patientSocket.socket_id).emit("appointmentStatusUpdated", {
            ...notif.toObject(),
            createdAt: notif.createdAt
          });
        }
      }

      // 🔹 Notify all admins
      for (const admin of admins) {
        const notif = await NotificationSchema.create({
          sender_id: userDetails?._id,
          receiver_id: admin._id,
          type: NotificationType.APPOINTMENT_CONFIRMED,
          message,
          reference_id: appointment._id,
          reference_model: "Appointment",
          read: false
        });
        notifications.push(notif);

        const adminSocket = await SocketSchema.findOne({ user_id: admin._id });
        if (adminSocket && adminSocket.socket_id && io) {
          io.to(adminSocket.socket_id).emit("appointmentStatusUpdated", {
            ...notif.toObject(),
            createdAt: notif.createdAt
          });
        }
      }






//             const notification = await NotificationSchema.create({
//                 sender_id: patient_id,
//                 receiver_id: user?._id,
//                 type: NotificationType.APPOINTMENT_REQUEST,
//                 // message: `New appointment request from patient ${patient_name} on ${date} (${time_slot?.start}-${time_slot?.end})`,
//                 message: `New appointment request from patient ${patient_name} on ${formattedDate} (${formattedStartTime}-${formattedEndTime})`,
//                 reference_id: appointment._id,
//                 reference_model: "Appointment",
//                 read: false
//             });
//             // const io = req.app.get('socketio');

//             const doctorSocket = await SocketSchema.findOne({ user_id: user._id });

//             if (doctorSocket && doctorSocket.socket_id) {
//             io.to(`${doctorSocket.socket_id}`).emit("appointmentRequest", {
//                 _id: notification?._id,
//                 sender_id: patient_id,
//                 receiver_id: user?._id,
//                 type: NotificationType.APPOINTMENT_REQUEST,
//                 // message: `New appointment request from patient ${patient_name} on ${date} (${time_slot?.start}-${time_slot?.end})`,
//                 message: `New appointment request from patient ${patient_name} on ${formattedDate} (${formattedStartTime}-${formattedEndTime})`,
//                 reference_id: appointment._id,
//                 reference_model: "Appointment",
//                 read: false
//             });
//             } else {
//             console.warn(` Doctor ${user?._id} not connected to socket. Notification saved to DB only.`);
// }


         

            logger.info(
                "Appointment created successfully",
                { appointment: appointment?._id }
            );


            return responseData.success(
                res,
                // appointment, 
                  {
          ...appointment.toObject(),
          patient_status: appointment.patient_status
        },
                messageConstants.DATA_SAVED_SUCCESSFULLY
            );
        } catch (error) {
            console.error(error);
            logger.error("Create appointment " + messageConstants.INTERNAL_SERVER_ERROR, error);
            return responseData.fail(
                res,
                messageConstants.INTERNAL_SERVER_ERROR,
                500
            );
        }
    });
};

// Helper to check if all slots for a day are booked
// Convert HH:mm → minutes


// Split schedule slots into intervals [startMin, endMin]
const normalizeSlots = (slots) => {
    return slots.map(s => [toMinutes(s.start), toMinutes(s.end)]);
};

// Merge overlapping/adjacent intervals
const mergeIntervals = (intervals) => {
    if (!intervals.length) return [];
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
        const [start, end] = intervals[i];
        const last = merged[merged.length - 1];
        if (start <= last[1]) {
            last[1] = Math.max(last[1], end);
        } else {
            merged.push([start, end]);
        }
    }
    return merged;
};

function mergeSlots(slots) {
    slots.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    const merged = [];
    let current = slots[0];

    for (let i = 1; i < slots.length; i++) {
        const next = slots[i];
        if (toMinutes(next.start) <= toMinutes(current.end)) {
            // overlapping or continuous → merge
            current.end = next.end > current.end ? next.end : current.end;
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    return merged;
}





// Subtract booked intervals from schedule
const subtractIntervals = (schedule, booked) => {
    let available = [...schedule];
    for (const [bStart, bEnd] of booked) {
        const newAvailable = [];
        for (const [sStart, sEnd] of available) {
            if (bEnd <= sStart || bStart >= sEnd) {
                // no overlap
                newAvailable.push([sStart, sEnd]);
            } else {
                if (bStart > sStart) newAvailable.push([sStart, bStart]);
                if (bEnd < sEnd) newAvailable.push([bEnd, sEnd]);
            }
        }
        available = newAvailable;
    }
    return available;
};

// Convert minutes back to HH:mm
const formatSlots = (intervals, withId = false) => {
    return intervals.map(([start, end, id]) => ({
        start: moment().startOf("day").add(start, "minutes").format("HH:mm"),
        end: moment().startOf("day").add(end, "minutes").format("HH:mm"),
        id: id
    }));
};


const normalizeSchedule = (slots) => {
    return slots.map(slot => [toMinutes(slot.start), toMinutes(slot.end)]);
};

const toMinutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};

// Merges old appointment slot into available slots for validation
const buildEffectiveSlots = (allBookings, oldAppointment) => {
    const matchingSlot = allBookings.find((slot) => slot.date === oldAppointment.date.toISOString().split("T")[0]);

    if (!matchingSlot) return [];

    let effectiveAvailable = [...(matchingSlot.slots?.available || [])];

    // add old appointment back to available pool
    effectiveAvailable.push(oldAppointment.time_slot);

    return effectiveAvailable;
};

const structureAppointmentHelper = async (doctorId, from, to) => {
    try {

        // Build query — filter by date only if both from+to provided
        const query = { staff_id: doctorId, status: { $nin: [AppointmentStatus?.CANCELLED, AppointmentStatus?.COMPLETED] } };
        let startDate, endDate;
        const hasRange = from && to;
        if (hasRange) {
            startDate = moment(from).startOf("day");
            endDate = moment(to).endOf("day");
            if (!startDate.isValid() || !endDate.isValid()) {
                return responseData.fail(res, "Invalid from/to dates", 400);
            }
            query.date = { $gte: startDate.toDate(), $lte: endDate.toDate() };
        }

        // Fetch data
        const [appointments, weeklySchedule, leaves] = await Promise.all([
            AppointmentSchema.find(query).lean(),
            WeeklyScheduleSchema.findOne({ staff_id: doctorId }).lean(),
            StaffLeaveSchema.find({ staff_id: doctorId }).lean(),
        ]);

        // helper to get reliable date string from an appointment
        const getApptDateStr = (appt) => {
            // prefer appt.date, fallback to createdAt
            const dt = appt && (appt.date);
            // if still falsy, return null so caller can decide
            if (!dt) return null;
            return moment(dt).format("YYYY-MM-DD");
        };

        const dayStatus = {};

        if (hasRange) {
            // Build a day map for the requested range
            let current = startDate.clone();
            while (current.isSameOrBefore(endDate)) {
                const dateStr = current.format("YYYY-MM-DD");
                dayStatus[dateStr] = { date: dateStr, status: "unavailable", events: [] };
                current.add(1, "day");
            }


            // Mark leaves that fall in range
            const leaveIntervals = [];
            leaves.forEach((leave) => {
                const leaveStart = moment(leave.start_date).startOf("day");
                const leaveEnd = moment(leave.end_date).endOf("day");
                Object.keys(dayStatus).forEach((dateStr) => {
                    const d = moment(dateStr, "YYYY-MM-DD");
                    if (d.isBetween(leaveStart, leaveEnd, null, "[]")) {
                        dayStatus[dateStr].status = "leave";

                        if (moment(d).isBetween(leaveStart, leaveEnd, null, "[]")) {
                            let startTime, endTime;

                            if (leave.leave_type === "CUSTOM") {
                                startTime = leave.start_time || "00:00";
                                endTime = leave.end_time || "23:59";
                            } else {
                                const times = leaveTypeTimes[leave.leave_type] || leaveTypeTimes.FULL_DAY;
                                startTime = times.start;
                                endTime = times.end;
                            }

                            leaveIntervals.push([toMinutes(startTime), toMinutes(endTime)]);



                            dayStatus[dateStr].events.push({
                                title: "Doctor on Leave",
                                start_date: leave.start_date,
                                end_date: leave.start_date,
                                start: startTime,
                                end: endTime,
                                full_day: leave.full_day,
                                status: leave?.status,
                                type: "leave",

                            });
                        }
                        // dayStatus[dateStr].slots = {
                        //     available: [],
                        //     booked: [], // 👈 pass flag to preserve id
                        // };


                    }
                });
            });



            // Add appointments into correct day bucket using appt.date
            appointments.forEach((appt) => {
                const dateStr = getApptDateStr(appt); // guaranteed to be string or null
                if (!dateStr) return; // skip malformed appt without date
                if (!dayStatus[dateStr]) return; // appointment outside requested range
                dayStatus[dateStr].events.push({
                    title: `${appt.time_slot?.start || ""}-${appt.time_slot?.end || ""}`,
                    start: appt.time_slot?.start, // you may convert to full Date when required by frontend
                    end: appt.time_slot?.end,
                    type: "booked",
                    status: appt?.status,
                    id: appt?._id,
                    visit_type: appt?.visit_type,
                    patient_id: appt?.patient_id,
                    creator:appt?.creator,
                    created_by:appt?.created_by
                });
                if (dayStatus[dateStr].status !== "leave") {
                    dayStatus[dateStr].status = "available";
                }
            });

            // Apply weekly schedule marking if day has no events
            // if (weeklySchedule) {
            //     Object.keys(dayStatus).forEach((dateStr) => {
            //         if (dayStatus[dateStr].status === "leave") return;
            //         const dayOfWeek = moment(dateStr).format("dddd").toLowerCase(); // monday...
            //         const slots = weeklySchedule[dayOfWeek];
            //         if (slots && slots.length > 0 && dayStatus[dateStr].events.length === 0) {
            //             dayStatus[dateStr].status = "available";
            //         }
            //     });
            // }
            if (weeklySchedule) {
                Object.keys(dayStatus).forEach((dateStr) => {
                    // if (dayStatus[dateStr].status === "leave") return;

                    const dayOfWeek = moment(dateStr).format("dddd").toUpperCase(); // e.g. "MONDAY"

                    const daySchedule = weeklySchedule.weekly_schedule.find(d => d.day === dayOfWeek);
                    const slots = daySchedule ? daySchedule.time_slots : [];

                    //     if (slots && slots.length > 0) {
                    //         if (dayStatus[dateStr].events.length === 0) {
                    //             // No appointments → available
                    //             dayStatus[dateStr].status = "available";
                    //         } else {
                    //             // Some appointments exist → check if fully booked
                    //             if (isFullyBooked(slots, dayStatus[dateStr].events)) {
                    //                 dayStatus[dateStr].status = "unavailable"; // fully booked
                    //             } else {
                    //                 dayStatus[dateStr].status = "available"; // still has free slots
                    //             }
                    //         }
                    //     }
                    // });
                    // const booked = dayStatus[dateStr].events
                    //     .filter(e => e.type === "booked")
                    //     .map(e => [toMinutes(e.start),
                    //     toMinutes(e.end)
                    //     ]);

                    // const mergedBooked = mergeIntervals(booked);

                    // // Subtract booked from schedule



                    // const scheduleIntervals = normalizeSchedule(slots);
                    // const available = subtractIntervals(scheduleIntervals, mergedBooked);

                    // dayStatus[dateStr].slots = {
                    //     available: formatSlots(available),
                    //     booked: formatSlots(mergedBooked),
                    // };


                    const booked = dayStatus[dateStr].events
                        .filter(e => e.type === "booked")
                        .map(e => ({
                            id: e.id, // store appointment id
                            start: toMinutes(e.start),
                            end: toMinutes(e.end),
                        }));

                    const leaves = dayStatus[dateStr].events
                        .filter(e => e.type === "leave")
                        .map(e => ({
                            id: e.id || null,
                            start: toMinutes(e.start),
                            end: toMinutes(e.end),
                        }));
                    // Merge only time ranges, but keep mapping back ids
                    const mergedBooked = mergeIntervals(
                        booked.map(b => [b.start, b.end])
                    ).map(interval => {
                        // Keep ids for intervals that overlap
                        const overlappingIds = booked
                            .filter(b => !(interval[1] <= b.start || interval[0] >= b.end))
                            .map(b => b.id);

                        return {
                            id: overlappingIds.length === 1 ? overlappingIds[0] : overlappingIds, // array if merged
                            start: interval[0],
                            end: interval[1],

                        };
                    });

                    const scheduleIntervals = normalizeSchedule(slots);

                    const unavailable = [
                        ...mergedBooked.map(b => [b.start, b.end]),
                        ...leaves.map(l => [l.start, l.end])
                    ];

                    const available = subtractIntervals(
                        scheduleIntervals,
                        // mergedBooked.map(b => [b.start, b.end])
                        unavailable
                    );

                    dayStatus[dateStr].slots = {
                        available: formatSlots(available),
                        booked: formatSlots(mergedBooked?.map(e => [e?.start, e?.end, e?.id]), true),
                        leave: formatSlots(leaves.map(l => [l.start, l.end, l.id || null])),
                    };


                    if (available.length === 0 && booked.length > 0) {
                        dayStatus[dateStr].status = "unavailable"; // fully booked
                    } else if (available.length > 0) {
                        dayStatus[dateStr].status = "available";
                    }
                });
            }

            return Object.values(dayStatus);
        } else {
            // NO range provided -> group ALL appointments by appointment date
            appointments.forEach((appt) => {
                const dateStr = getApptDateStr(appt) || moment(appt.createdAt || appt.created_at || new Date()).format("YYYY-MM-DD");
                if (!dayStatus[dateStr]) {
                    dayStatus[dateStr] = { date: dateStr, status: "unavailable", events: [] };
                }
                dayStatus[dateStr].events.push({
                    // title: `Booked - ${appt.patientName || appt.patient_name || "Patient"}`,
                    title: `${appt.time_slot?.start || ""}-${appt.time_slot?.end || ""}`,
                    start: appt.time_slot?.start,
                    end: appt.time_slot?.end,
                    type: "booked",
                    status: appt?.status,
                    id: appt?._id,
                    visit_type: appt?.visit_type,
                    patient_id: appt?.patient_id,
                    creator:appt?.creator,
                    created_by:appt?.created_by

                });
                if (dayStatus[dateStr].status !== "leave") {
                    dayStatus[dateStr].status = "available";
                }
            });

            // Apply weekly schedule (mark available days)

            if (weeklySchedule) {
                Object.keys(dayStatus).forEach((dateStr) => {
                    if (dayStatus[dateStr].status === "leave") return;

                    const dayOfWeek = moment(dateStr).format("dddd").toUpperCase(); // e.g. "MONDAY"

                    const daySchedule = weeklySchedule.weekly_schedule.find(d => d.day === dayOfWeek);
                    const slots = daySchedule ? daySchedule.time_slots : [];

                    //     if (slots && slots.length > 0) {
                    //         if (dayStatus[dateStr].events.length === 0) {
                    //             // No appointments → available
                    //             dayStatus[dateStr].status = "available";
                    //         } else {
                    //             // Some appointments exist → check if fully booked
                    //             if (isFullyBooked(slots, dayStatus[dateStr].events)) {
                    //                 dayStatus[dateStr].status = "unavailable"; // fully booked
                    //             } else {
                    //                 dayStatus[dateStr].status = "available"; // still has free slots
                    //             }
                    //         }
                    //     }
                    // });
                    const booked = dayStatus[dateStr].events
                        .filter(e => e.type === "booked")
                        .map(e => [toMinutes(e.start), toMinutes(e.end)]);

                    const mergedBooked = mergeIntervals(booked);

                    // Subtract booked from schedule



                    const scheduleIntervals = normalizeSchedule(slots);
                    const available = subtractIntervals(scheduleIntervals, mergedBooked);

                    dayStatus[dateStr].slots = {
                        available: formatSlots(available),
                        booked: formatSlots(mergedBooked),
                    };

                    if (available.length === 0 && booked.length > 0) {
                        dayStatus[dateStr].status = "unavailable"; // fully booked
                    } else if (available.length > 0) {
                        dayStatus[dateStr].status = "available";
                    }
                });
            }


            // mark leaves for any matching appointment days (optional)
            leaves.forEach((leave) => {
                const leaveStart = moment(leave.start).startOf("day");
                const leaveEnd = moment(leave.end).endOf("day");
                Object.keys(dayStatus).forEach((dateStr) => {
                    const d = moment(dateStr, "YYYY-MM-DD");
                    if (d.isBetween(leaveStart, leaveEnd, null, "[]")) {
                        dayStatus[dateStr].status = "leave";
                        dayStatus[dateStr].events.unshift({
                            title: "Doctor on Leave",
                            start: d.startOf("day").toDate(),
                            end: d.endOf("day").toDate(),
                            type: "leave",
                        });
                    }
                });
            });

            return Object.values(dayStatus);;
        }
    } catch (error) {
        console.error("getAppointmentByDoctor error:", error);
        return error;
    }



}

const getAppontmentByDoctor = async (req, res) => {
    return new Promise(async () => {

        try {
            const doctorId = req.params._id;
            const { from, to } = req.query;

            const result = await structureAppointmentHelper(doctorId, from, to)

            // // Build query — filter by date only if both from+to provided
            // const query = { staff_id: doctorId, status: { $ne: AppointmentStatus?.CANCELLED } };
            // let startDate, endDate;
            // const hasRange = from && to;
            // if (hasRange) {
            //     startDate = moment(from).startOf("day");
            //     endDate = moment(to).endOf("day");
            //     if (!startDate.isValid() || !endDate.isValid()) {
            //         return responseData.fail(res, "Invalid from/to dates", 400);
            //     }
            //     query.date = { $gte: startDate.toDate(), $lte: endDate.toDate() };
            // }

            // // Fetch data
            // const [appointments, weeklySchedule, leaves] = await Promise.all([
            //     AppointmentSchema.find(query).lean(),
            //     WeeklyScheduleSchema.findOne({ staff_id: doctorId }).lean(),
            //     StaffLeaveSchema.find({ staff_id: doctorId }).lean(),
            // ]);

            // // helper to get reliable date string from an appointment
            // const getApptDateStr = (appt) => {
            //     // prefer appt.date, fallback to createdAt
            //     const dt = appt && (appt.date);
            //     // if still falsy, return null so caller can decide
            //     if (!dt) return null;
            //     return moment(dt).format("YYYY-MM-DD");
            // };

            // const dayStatus = {};

            // if (hasRange) {
            //     // Build a day map for the requested range
            //     let current = startDate.clone();
            //     while (current.isSameOrBefore(endDate)) {
            //         const dateStr = current.format("YYYY-MM-DD");
            //         dayStatus[dateStr] = { date: dateStr, status: "unavailable", events: [] };
            //         current.add(1, "day");
            //     }

            //     // Mark leaves that fall in range
            //     leaves.forEach((leave) => {
            //         const leaveStart = moment(leave.start).startOf("day");
            //         const leaveEnd = moment(leave.end).endOf("day");
            //         Object.keys(dayStatus).forEach((dateStr) => {
            //             const d = moment(dateStr, "YYYY-MM-DD");
            //             if (d.isBetween(leaveStart, leaveEnd, null, "[]")) {
            //                 dayStatus[dateStr].status = "leave";
            //                 dayStatus[dateStr].events.push({
            //                     title: "Doctor on Leave",
            //                     start: d.startOf("day").toDate(),
            //                     end: d.endOf("day").toDate(),
            //                     type: "leave",

            //                 });
            //             }
            //         });
            //     });



            //     // Add appointments into correct day bucket using appt.date
            //     appointments.forEach((appt) => {
            //         const dateStr = getApptDateStr(appt); // guaranteed to be string or null
            //         if (!dateStr) return; // skip malformed appt without date
            //         if (!dayStatus[dateStr]) return; // appointment outside requested range
            //         dayStatus[dateStr].events.push({
            //             title: `${appt.time_slot?.start || ""}-${appt.time_slot?.end || ""}`,
            //             start: appt.time_slot?.start, // you may convert to full Date when required by frontend
            //             end: appt.time_slot?.end,
            //             type: "booked",
            //             status: appt?.status,
            //             id: appt?._id,
            //             visit_type: appt?.visit_type,
            //             patient_id: appt?.patient_id
            //         });
            //         if (dayStatus[dateStr].status !== "leave") {
            //             dayStatus[dateStr].status = "available";
            //         }
            //     });

            //     // Apply weekly schedule marking if day has no events
            //     // if (weeklySchedule) {
            //     //     Object.keys(dayStatus).forEach((dateStr) => {
            //     //         if (dayStatus[dateStr].status === "leave") return;
            //     //         const dayOfWeek = moment(dateStr).format("dddd").toLowerCase(); // monday...
            //     //         const slots = weeklySchedule[dayOfWeek];
            //     //         if (slots && slots.length > 0 && dayStatus[dateStr].events.length === 0) {
            //     //             dayStatus[dateStr].status = "available";
            //     //         }
            //     //     });
            //     // }
            //     if (weeklySchedule) {
            //         Object.keys(dayStatus).forEach((dateStr) => {
            //             if (dayStatus[dateStr].status === "leave") return;

            //             const dayOfWeek = moment(dateStr).format("dddd").toUpperCase(); // e.g. "MONDAY"

            //             const daySchedule = weeklySchedule.weekly_schedule.find(d => d.day === dayOfWeek);
            //             const slots = daySchedule ? daySchedule.time_slots : [];

            //             //     if (slots && slots.length > 0) {
            //             //         if (dayStatus[dateStr].events.length === 0) {
            //             //             // No appointments → available
            //             //             dayStatus[dateStr].status = "available";
            //             //         } else {
            //             //             // Some appointments exist → check if fully booked
            //             //             if (isFullyBooked(slots, dayStatus[dateStr].events)) {
            //             //                 dayStatus[dateStr].status = "unavailable"; // fully booked
            //             //             } else {
            //             //                 dayStatus[dateStr].status = "available"; // still has free slots
            //             //             }
            //             //         }
            //             //     }
            //             // });
            //             // const booked = dayStatus[dateStr].events
            //             //     .filter(e => e.type === "booked")
            //             //     .map(e => [toMinutes(e.start),
            //             //     toMinutes(e.end)
            //             //     ]);

            //             // const mergedBooked = mergeIntervals(booked);

            //             // // Subtract booked from schedule



            //             // const scheduleIntervals = normalizeSchedule(slots);
            //             // const available = subtractIntervals(scheduleIntervals, mergedBooked);

            //             // dayStatus[dateStr].slots = {
            //             //     available: formatSlots(available),
            //             //     booked: formatSlots(mergedBooked),
            //             // };


            //             const booked = dayStatus[dateStr].events
            //                 .filter(e => e.type === "booked")
            //                 .map(e => ({
            //                     id: e.id, // store appointment id
            //                     start: toMinutes(e.start),
            //                     end: toMinutes(e.end),
            //                 }));
            //             // Merge only time ranges, but keep mapping back ids
            //             const mergedBooked = mergeIntervals(
            //                 booked.map(b => [b.start, b.end])
            //             ).map(interval => {
            //                 // Keep ids for intervals that overlap
            //                 const overlappingIds = booked
            //                     .filter(b => !(interval[1] <= b.start || interval[0] >= b.end))
            //                     .map(b => b.id);

            //                 return {
            //                     id: overlappingIds.length === 1 ? overlappingIds[0] : overlappingIds, // array if merged
            //                     start: interval[0],
            //                     end: interval[1],
            //                 };
            //             });

            //             const scheduleIntervals = normalizeSchedule(slots);

            //             const available = subtractIntervals(
            //                 scheduleIntervals,
            //                 mergedBooked.map(b => [b.start, b.end])
            //             );

            //             dayStatus[dateStr].slots = {
            //                 available: formatSlots(available),
            //                 booked: formatSlots(mergedBooked?.map(e => [e?.start, e?.end, e?.id]), true), // 👈 pass flag to preserve id
            //             };


            //             if (available.length === 0 && booked.length > 0) {
            //                 dayStatus[dateStr].status = "unavailable"; // fully booked
            //             } else if (available.length > 0) {
            //                 dayStatus[dateStr].status = "available";
            //             }
            //         });
            //     }

            return responseData.success(res, result, messageConstants.FETCHED_SUCCESSFULLY);
            // } else {
            //     // NO range provided -> group ALL appointments by appointment date
            //     appointments.forEach((appt) => {
            //         const dateStr = getApptDateStr(appt) || moment(appt.createdAt || appt.created_at || new Date()).format("YYYY-MM-DD");
            //         if (!dayStatus[dateStr]) {
            //             dayStatus[dateStr] = { date: dateStr, status: "unavailable", events: [] };
            //         }
            //         dayStatus[dateStr].events.push({
            //             // title: `Booked - ${appt.patientName || appt.patient_name || "Patient"}`,
            //             title: `${appt.time_slot?.start || ""}-${appt.time_slot?.end || ""}`,
            //             start: appt.time_slot?.start,
            //             end: appt.time_slot?.end,
            //             type: "booked",
            //             status: appt?.status,
            //             id: appt?._id,
            //             visit_type: appt?.visit_type,
            //             patient_id: appt?.patient_id
            //         });
            //         if (dayStatus[dateStr].status !== "leave") {
            //             dayStatus[dateStr].status = "available";
            //         }
            //     });

            //     // Apply weekly schedule (mark available days)

            //     if (weeklySchedule) {
            //         Object.keys(dayStatus).forEach((dateStr) => {
            //             if (dayStatus[dateStr].status === "leave") return;

            //             const dayOfWeek = moment(dateStr).format("dddd").toUpperCase(); // e.g. "MONDAY"

            //             const daySchedule = weeklySchedule.weekly_schedule.find(d => d.day === dayOfWeek);
            //             const slots = daySchedule ? daySchedule.time_slots : [];

            //             //     if (slots && slots.length > 0) {
            //             //         if (dayStatus[dateStr].events.length === 0) {
            //             //             // No appointments → available
            //             //             dayStatus[dateStr].status = "available";
            //             //         } else {
            //             //             // Some appointments exist → check if fully booked
            //             //             if (isFullyBooked(slots, dayStatus[dateStr].events)) {
            //             //                 dayStatus[dateStr].status = "unavailable"; // fully booked
            //             //             } else {
            //             //                 dayStatus[dateStr].status = "available"; // still has free slots
            //             //             }
            //             //         }
            //             //     }
            //             // });
            //             const booked = dayStatus[dateStr].events
            //                 .filter(e => e.type === "booked")
            //                 .map(e => [toMinutes(e.start), toMinutes(e.end)]);

            //             const mergedBooked = mergeIntervals(booked);

            //             // Subtract booked from schedule



            //             const scheduleIntervals = normalizeSchedule(slots);
            //             const available = subtractIntervals(scheduleIntervals, mergedBooked);

            //             dayStatus[dateStr].slots = {
            //                 available: formatSlots(available),
            //                 booked: formatSlots(mergedBooked),
            //             };

            //             if (available.length === 0 && booked.length > 0) {
            //                 dayStatus[dateStr].status = "unavailable"; // fully booked
            //             } else if (available.length > 0) {
            //                 dayStatus[dateStr].status = "available";
            //             }
            //         });
            //     }


            //     // mark leaves for any matching appointment days (optional)
            //     leaves.forEach((leave) => {
            //         const leaveStart = moment(leave.start).startOf("day");
            //         const leaveEnd = moment(leave.end).endOf("day");
            //         Object.keys(dayStatus).forEach((dateStr) => {
            //             const d = moment(dateStr, "YYYY-MM-DD");
            //             if (d.isBetween(leaveStart, leaveEnd, null, "[]")) {
            //                 dayStatus[dateStr].status = "leave";
            //                 dayStatus[dateStr].events.unshift({
            //                     title: "Doctor on Leave",
            //                     start: d.startOf("day").toDate(),
            //                     end: d.endOf("day").toDate(),
            //                     type: "leave",
            //                 });
            //             }
            //         });
            //     });

            //     return responseData.success(res, Object.values(dayStatus), messageConstants.FETCHED_SUCCESSFULLY);
            // }
        } catch (error) {
            console.error("getAppointmentByDoctor error:", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }

    })

}

const getAppontmentByPatient = async (req, res) => {
  return new Promise(async () => {
    try {
      const { doctor_id, patient_id } = req.params;
      const { from, to } = req.query;

      // Validate IDs
      if (!mongoose.Types.ObjectId.isValid(doctor_id) || !mongoose.Types.ObjectId.isValid(patient_id)) {
        return responseData.fail(res, "Invalid doctor or patient ID", 400);
      }

      // Build query — similar to structureAppointmentHelper but filtered by patient_id too
      const query = {
        staff_id: new mongoose.Types.ObjectId(doctor_id),
        patient_id: new mongoose.Types.ObjectId(patient_id),
        // status: { $ne: AppointmentStatus.CANCELLED },
      };

      let startDate, endDate;
      const hasRange = from && to;
      if (hasRange) {
        startDate = moment(from).startOf("day");
        endDate = moment(to).endOf("day");

        if (!startDate.isValid() || !endDate.isValid()) {
          return responseData.fail(res, "Invalid from/to dates", 400);
        }

        query.date = { $gte: startDate.toDate(), $lte: endDate.toDate() };
      }

      // Fetch data
      const [appointments, weeklySchedule, leaves] = await Promise.all([
        AppointmentSchema.find(query).lean(),
        WeeklyScheduleSchema.findOne({ staff_id: doctor_id }).lean(),
        StaffLeaveSchema.find({ staff_id: doctor_id }).lean(),
      ]);

      // Prepare day-wise structure
      const getApptDateStr = (appt) => (appt && appt.date ? moment(appt.date).format("YYYY-MM-DD") : null);

      const dayStatus = {};

      if (hasRange) {
        // Create range days
        let current = startDate.clone();
        while (current.isSameOrBefore(endDate)) {
          const dateStr = current.format("YYYY-MM-DD");
          dayStatus[dateStr] = { date: dateStr, status: "unavailable", events: [] };
          current.add(1, "day");
        }

        // Add appointments into dayStatus
        appointments.forEach((appt) => {
          const dateStr = getApptDateStr(appt);
          if (!dateStr || !dayStatus[dateStr]) return;
          dayStatus[dateStr].events.push({
            title: `${appt.time_slot?.start || ""}-${appt.time_slot?.end || ""}`,
            start: appt.time_slot?.start,
            end: appt.time_slot?.end,
            type: "booked",
            status: appt.status,
            id: appt._id,
            visit_type: appt.visit_type,
            patient_id: appt.patient_id,
            creator: appt.creator,
            created_by: appt.created_by,
          });
          dayStatus[dateStr].status = "available";
        });

        // Weekly schedule slots
        if (weeklySchedule) {
          Object.keys(dayStatus).forEach((dateStr) => {
            const dayOfWeek = moment(dateStr).format("dddd").toUpperCase();
            const daySchedule = weeklySchedule.weekly_schedule.find((d) => d.day === dayOfWeek);
            const slots = daySchedule ? daySchedule.time_slots : [];

            const booked = dayStatus[dateStr].events.map((e) => [toMinutes(e.start), toMinutes(e.end)]);
            const mergedBooked = mergeIntervals(booked);
            const scheduleIntervals = normalizeSchedule(slots);
            const available = subtractIntervals(scheduleIntervals, mergedBooked);

            dayStatus[dateStr].slots = {
              available: formatSlots(available),
              booked: formatSlots(mergedBooked),
              leave: [],
            };

            if (available.length === 0 && booked.length > 0) {
              dayStatus[dateStr].status = "unavailable";
            } else if (available.length > 0) {
              dayStatus[dateStr].status = "available";
            }
          });
        }

        return responseData.success(res, Object.values(dayStatus), messageConstants.FETCHED_SUCCESSFULLY);
      } else {
        // No range -> group by date
        appointments.forEach((appt) => {
          const dateStr = getApptDateStr(appt) || moment(appt.createdAt).format("YYYY-MM-DD");
          if (!dayStatus[dateStr]) {
            dayStatus[dateStr] = { date: dateStr, status: "unavailable", events: [] };
          }
          dayStatus[dateStr].events.push({
            title: `${appt.time_slot?.start || ""}-${appt.time_slot?.end || ""}`,
            start: appt.time_slot?.start,
            end: appt.time_slot?.end,
            type: "booked",
            status: appt.status,
            id: appt._id,
            visit_type: appt.visit_type,
            patient_id: appt.patient_id,
            creator: appt.creator,
            created_by: appt.created_by,
          });
          dayStatus[dateStr].status = "available";
        });

        return responseData.success(res, Object.values(dayStatus), messageConstants.FETCHED_SUCCESSFULLY);
      }
    } catch (error) {
      console.error("getAppontmentByPatient error:", error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};


// const getAppointmentList = async(req,res)=>{
//       return new Promise(async () => {

//         try {
//             // const doctorId = req.params._id;
//             // const { from, to } = req.query;
//             const doctorId = req.params._id;
//             const { from, to, status } = req.query;
//             const query = { staff_id: doctorId };
//             if (status) {
//                 const statusArray = status.split(",").map(s => s.trim()); 
//                 if (statusArray.length === 1) {
//                 query.status = statusArray[0]; 
//                 } else {
//                 query.status = { $in: statusArray }; 
//                 }
//             }
//             let startDate, endDate;
//             const hasRange = from && to;
//             if (hasRange) {
//             startDate = moment(from).startOf("day");
//             endDate = moment(to).endOf("day");

//             if (!startDate.isValid() || !endDate.isValid()) {
//                 return responseData.fail(res, "Invalid from/to dates", 400);
//             }

//             query.date = { $gte: startDate.toDate(), $lte: endDate.toDate() };
//             }
//             const result = await AppointmentSchema.find(query).sort({ createdAt: -1 }).lean();
//             // const result = await AppointmentSchema.find({ staff_id: doctorId}).lean();
//             return responseData.success(res, result, messageConstants.FETCHED_SUCCESSFULLY);
           
//         } catch (error) {
//             console.error("getAppointmentByDoctor error:", error);
//             return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
//         }

//     })
// }

const getAppointmentList = async (req, res) => {
    return new Promise(async () => {
  try {
    const staffId = req.params._id ;
    const { from, to, status } = req.query;

    if (!staffId) {
      return responseData.fail(res, "Staff ID is required", 400);
    }

    // Date filter setup
    const filter = {
      staff_id: staffId,
    };

    if (from && to) {
      filter.date = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    //  if (status) {
    //     filter.status = status;
    //   }
    if (status) {
  const statusArray = status.split(",").map((s) => s.trim());
  if (statusArray.length === 1) {
    filter.status = statusArray[0];
  } else {
    filter.status = { $in: statusArray };
  }
}



    const appointments = await AppointmentSchema.find(filter)
      .populate({
        path: 'patient_id',
        model: UserSchema,
        select: 'firstname lastname phone address countryCode city state country'
      })
      .sort({ date: 1 }); // optional: sort by date

    const formattedAppointments = appointments.map((apt) => {
      const patient = apt.patient_id || {};

      return {
        _id: apt._id,
        staff_id: apt.staff_id,
        patient_id: patient._id || null,
        date: apt.date,
        time_slot: apt.time_slot,
        visit_type: apt.visit_type,
        status: apt.status,
        message: apt.message || "",
        created_by: apt.created_by,
        creator: apt.creator,
        createdAt: apt.createdAt,
        updatedAt: apt.updatedAt,

        // ✅ New fields added:
        patient_name: patient.firstname && patient.lastname 
          ? `${patient.firstname} ${patient.lastname}` 
          : patient.firstname || "",
        patient_phone: patient.countryCode && patient.phone
          ? `${patient.countryCode}${patient.phone}`
          : patient.phone || "",
        patient_address: patient.address || "",
        patient_city: patient.city||"",
         patient_state: patient.state||"",
          patient_country: patient.country||"",
      };
    });

    logger.info("Appointments fetched successfully");

    return responseData.success(
      res,
      formattedAppointments,
      messageConstants.DATA_FETCHED_SUCCESSFULLY
    );
  } catch (error) {
    logger.error("Get Appointment List " + messageConstants.INTERNAL_SERVER_ERROR, error);
    return responseData.fail(
      res,
      messageConstants.INTERNAL_SERVER_ERROR,
      500
    );
  }
   })
};


const getPatients = async (req, res) => {
     return new Promise(async () => {
  try {
    const {
      doctor_id = null,
      search = "",
      skip,
      limit,
      from_date,
      to_date,
      patient_status,
    } = req.query;

    const skipVal = skip && !isNaN(skip) ? parseInt(skip) : 0;
    const limitVal = limit && !isNaN(limit) ? parseInt(limit) : null;

    // 🔹 Base match condition for patients
    const match = {
      role: UserTypes.USER,
      is_deleted: false,
    };

    // 🔹 Search filter
    if (search) {
      match.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$phone" },
              regex: search,
              options: "i",
            },
          },
        },
      ];
    }

    // 🔹 Date range filter (created_at)
    let dateFilter = {};
    if (from_date) dateFilter.$gte = new Date(from_date);
    if (to_date) dateFilter.$lte = new Date(to_date);
    if (Object.keys(dateFilter).length > 0) {
      match.created_at = dateFilter;
    }

    // 🔹 Aggregation pipeline
    const pipeline = [
      { $match: match },

      // Join appointments for each patient
      {
        $lookup: {
          from: "appointments",
          let: { patientId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$patient_id", "$$patientId"],
                },
              },
            },
            { $sort: { createdAt: -1 } },
          ],
          as: "appointments",
        },
      },

      // Filter only those who have appointments with selected doctor (if doctor_id provided)
      ...(doctor_id && mongoose.Types.ObjectId.isValid(doctor_id)
        ? [
            {
              $addFields: {
                appointments: {
                  $filter: {
                    input: "$appointments",
                    as: "appt",
                    cond: {
                      $eq: [
                        "$$appt.staff_id",
                        new mongoose.Types.ObjectId(doctor_id),
                      ],
                    },
                  },
                },
              },
            },
            {
              $match: {
                "appointments.0": { $exists: true }, // keep only patients having at least 1 appointment with this doctor
              },
            },
          ]
        : []),

      // Add visit_count field
      {
        $addFields: {
          patient_status: { $arrayElemAt: ["$appointments.patient_status", 0] },
          patient_message: { $arrayElemAt: ["$appointments.patient_message", 0] },
          visit_count: { $size: "$appointments" },
        },
      },

      // ...(patient_status
      //     ? [
      //         {
      //           $match: {
      //             patient_status: patient_status,
      //           },
      //         },
      //       ]
      //     : []),
      ...(patient_status
  ? [
      {
        $match: {
          patient_status: {
            $in: patient_status.split(",").map((s) => s.trim()),
          },
        },
      },
    ]
  : []),

      

      // Sort latest first
      { $sort: { created_at: -1 } },

      // Pagination
      ...(limitVal ? [{ $skip: skipVal }, { $limit: limitVal }] : []),

      // Project only needed fields
      {
        $project: {
          _id: 1,
          firstname: 1,
          lastname: 1,
          email: 1,
          phone: 1,
          address: 1,
          country: 1,
          state: 1,
          city: 1,
          gender: 1,
          assign_doctor: 1,
          patient_status: 1,
          patient_message: 1,
          dob: {
            $cond: {
              if: { $ifNull: ["$dob", false] },
              then: { $dateToString: { format: "%d/%m/%Y", date: "$dob" } },
              else: null,
            },
          },
          visit_count: 1,
        },
      },
    ];

    // Execute aggregation and count
    const [patients, totalCount] = await Promise.all([
      UserSchema.aggregate(pipeline),
      // Count total unique patients matching filters
      doctor_id
        ? AppointmentSchema.aggregate([
            {
              $match: {
                staff_id: new mongoose.Types.ObjectId(doctor_id),
              },
            },
            { $group: { _id: "$patient_id" } },
            { $count: "count" },
          ]).then((r) => (r[0]?.count || 0))
        : UserSchema.countDocuments(match),
    ]);

    return responseData.success(
      res,
       patients, 
      messageConstants.FETCHED_SUCCESSFULLY,
      {
        // rows: patients,
        total_count: totalCount,
      },
      
    );
  } catch (error) {
    logger.error("Get Patients Error:", error);
    return responseData.fail(
      res,
      messageConstants.INTERNAL_SERVER_ERROR,
      500
    );
  }
  })
};


// const updateAppointmentStatus = async (req, res) => {
//     return new Promise(async () => {
//         try {
//             const { reference_id, sender_id, status, message, notification_id } = req?.body
//             const actorId = req.userDetails?._id;

//             // 1. validate input
//             if (!reference_id) {
//                 return responseData.fail(res, "reference_id is required", 400);
//             }
//             if (!status || ![AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED].includes(status)) {
//                 return responseData.fail(res, "Invalid status. Must be CONFIRMED or CANCELLED.", 400);
//             }

//             // 2. fetch appointment
//             const appointment = await AppointmentSchema.findByIdAndUpdate(
//                 reference_id,
//                 { status }, // update only status
//                 { new: true } // return updated doc
//             );
//             if (!appointment) {
//                 return responseData.fail(res, "Appointment not found", 404);
//             }

//             // 3. update status


//             // 4. mark original notification (if provided) as read/handled
//             if (notification_id) {
//                 try {
//                     await NotificationSchema.findByIdAndUpdate(notification_id, { read: true });
//                 } catch (err) {
//                     logger.warn("Failed to mark original notification as read", err);
//                 }
//             }

//             // 5. build recipients set
//             // sender_id (from payload) is expected to be the original requester (patient/admin)
//             // appointment.creator is authoritative fallback
//             const recipients = new Set();
//             if (sender_id) recipients.add(String(sender_id));
//             if (appointment.creator) recipients.add(appointment.creator.toString());
//             // remove actor (doctor) from recipients if present
//             if (actorId) recipients.delete(String(actorId));

//             const recipientsArr = Array.from(recipients);

//             // 6. determine notification type and default message
//             const notifType = status === AppointmentStatus.CONFIRMED
//                 ? (NotificationType?.APPOINTMENT_CONFIRMED || "APPOINTMENT_CONFIRMED")
//                 : (NotificationType?.APPOINTMENT_CANCELLED || NotificationType?.APPOINTMENT_DECLINED || "APPOINTMENT_CANCELLED");

//             const appointmentDate = new Date(appointment.date);
//             const formattedDate = `${String(appointmentDate.getDate()).padStart(2, '0')}/${String(appointmentDate.getMonth() + 1).padStart(2, '0')}/${appointmentDate.getFullYear()}`;
//             const formatTimeTo12Hour = (timeString) => {
//                 const [hours, minutes] = timeString.split(':');
//                 const hour = parseInt(hours);
//                 const ampm = hour >= 12 ? 'PM' : 'AM';
//                 const twelveHour = hour % 12 || 12;
//                 return `${twelveHour}:${minutes} ${ampm}`;
//             };
//             const formattedStartTime = formatTimeTo12Hour(appointment.time_slot?.start);
//             const formattedEndTime = formatTimeTo12Hour(appointment.time_slot?.end);
//             const defaultMsg = status === AppointmentStatus.CONFIRMED
//                 ? `Your appointment on ${formattedDate} (${formattedStartTime} - ${formattedEndTime}) has been confirmed.`
//                 : `Your appointment on ${formattedDate} (${formattedStartTime} - ${formattedEndTime}) has been declined.`;
//             // const defaultMsg = status === AppointmentStatus.CONFIRMED
//             //     ? `Your appointment on ${appointment.date.toDateString()} (${appointment.time_slot?.start || ""} - ${appointment.time_slot?.end || ""}) has been confirmed.`
//             //     : `Your appointment on ${appointment.date.toDateString()} (${appointment.time_slot?.start || ""} - ${appointment.time_slot?.end || ""}) has been declined.`;

//             // 7. create notifications (one per user) and emit via socket if online
//             const createdNotifications = [];
//             const io = req.app?.get("socketio"); // your socket instance (may be undefined in some tests)

//             for (const receiverId of recipientsArr) {
//                 const notifPayload = {
//                     sender_id: actorId || null,         // doctor who acted
//                     receiver_id: receiverId,
//                     type: notifType,
//                     message: defaultMsg,
//                     reference_id: appointment._id,
//                     reference_model: "Appointment",
//                     read: false,
//                     reason: message
//                 };

//                 const created = await NotificationSchema.create(notifPayload);
//                 createdNotifications.push(created);

//                 const emitPayload = {
//                     ...notifPayload,
//                     _id: created._id,     // include DB id
//                     createdAt: created.createdAt
//                 };

//                 // send realtime if socket info available
//                 try {
//                     // try to find socket record for receiver
//                     const socketRec = await SocketSchema.findOne({ user_id: receiverId });

//                     if (io && socketRec && socketRec.socket_id) {
//                         // emit directly to that socket id (recommended in your setup)
//                         io.to(socketRec.socket_id).emit("appointmentStatusUpdated", emitPayload);
//                     } else if (io) {
//                         // optional: if you also join user rooms (userId) you could do:
//                         // io.to(String(receiverId)).emit(...)
//                         // or skip if offline
//                         logger.info(`Recipient ${receiverId} not connected via socket (socketRec missing). Notification saved to DB.`);
//                     }
//                 } catch (emitErr) {
//                     logger.warn("Failed to emit socket notification", emitErr);
//                 }
//             }

//             // 8. return result
//             return responseData.success(res, { appointment, notified: recipientsArr }, messageConstants.DATA_SAVED_SUCCESSFULLY);


//         } catch (error) {
//             console.error("update appointment error:", error);
//             return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
//         }
//     })
// }

const updateAppointmentStatus = async (req, res) => {
  return new Promise(async () => {
    try {
      const { reference_id, sender_id, status, message, notification_id } = req?.body;
      const actorId = req.userDetails?._id;

      // 1️⃣ Validate inputs
      if (!reference_id) {
        return responseData.fail(res, "reference_id is required", 400);
      }
      if (
        !status ||
        ![
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.CANCELLED,
          AppointmentStatus.COMPLETED
        ].includes(status)
      ) {
        return responseData.fail(
          res,
          "Invalid status. Must be CONFIRMED, CANCELLED or COMPLETED.",
          400
        );
      }

      // 2️⃣ Fetch and update appointment
      const appointment = await AppointmentSchema.findById(reference_id);
      if (!appointment) {
        return responseData.fail(res, "Appointment not found", 404);
      }

      const oldStatus = appointment.status;
      appointment.status = status;
      appointment.message = message || "";
      await appointment.save();

      // 3️⃣ Mark original notification as read if exists
      if (notification_id) {
        try {
          await NotificationSchema.findByIdAndUpdate(notification_id, { read: true });
        } catch (err) {
          logger.warn("Failed to mark original notification as read", err);
        }
      }

      // 4️⃣ Determine if notification should be sent
      let shouldNotify = false;
      let notifType = "";
      let defaultMsg = "";

      const appointmentDate = new Date(appointment.date);
      const formattedDate = `${String(appointmentDate.getDate()).padStart(2, "0")}/${String(
        appointmentDate.getMonth() + 1
      ).padStart(2, "0")}/${appointmentDate.getFullYear()}`;

      const formatTimeTo12Hour = (timeString) => {
        const [hours, minutes] = timeString.split(":");
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? "PM" : "AM";
        const twelveHour = hour % 12 || 12;
        return `${twelveHour}:${minutes} ${ampm}`;
      };

      const formattedStartTime = formatTimeTo12Hour(appointment.time_slot?.start);
      const formattedEndTime = formatTimeTo12Hour(appointment.time_slot?.end);

      // ✅ CONFIRMED → CANCELLED
      if (oldStatus === AppointmentStatus.CONFIRMED && status === AppointmentStatus.CANCELLED) {
        shouldNotify = true;
        notifType = NotificationType.APPOINTMENT_CANCELLED || "APPOINTMENT_CANCELLED";
        defaultMsg = `Your appointment on ${formattedDate} (${formattedStartTime} - ${formattedEndTime}) has been declined.`;
      }

      // ✅ CANCELLED → CONFIRMED
      else if (oldStatus === AppointmentStatus.CANCELLED && status === AppointmentStatus.CONFIRMED) {
        shouldNotify = true;
        notifType = NotificationType.APPOINTMENT_CONFIRMED || "APPOINTMENT_CONFIRMED";
        defaultMsg = `Your appointment on ${formattedDate} (${formattedStartTime} - ${formattedEndTime}) has been confirmed.`;
      }

      // ⚠️ CONFIRMED → COMPLETED → No notification
      else if (oldStatus === AppointmentStatus.CONFIRMED && status === AppointmentStatus.COMPLETED) {
        shouldNotify = false;
      }

      // 5️⃣ Build recipients
      const recipients = new Set();
      if (sender_id) recipients.add(String(sender_id));
      if (appointment.creator) recipients.add(appointment.creator.toString());
      if (actorId) recipients.delete(String(actorId)); // remove doctor if same

      const recipientsArr = Array.from(recipients);
      const io = req.app?.get("socketio");

      // 6️⃣ Send notification (only if needed)
      if (shouldNotify) {
        const createdNotifications = [];

        for (const receiverId of recipientsArr) {
          const notifPayload = {
            sender_id: actorId || null,
            receiver_id: receiverId,
            type: notifType,
            message: defaultMsg,
            reference_id: appointment._id,
            reference_model: "Appointment",
            read: false,
            reason: message,
          };

          const created = await NotificationSchema.create(notifPayload);
          createdNotifications.push(created);

          // emit via socket
          try {
            const socketRec = await SocketSchema.findOne({ user_id: receiverId });
            if (io && socketRec && socketRec.socket_id) {
              io.to(socketRec.socket_id).emit("appointmentStatusUpdated", {
                ...notifPayload,
                _id: created._id,
                createdAt: created.createdAt,
              });
            } else if (io) {
              logger.info(
                `Recipient ${receiverId} not connected via socket. Notification saved to DB.`
              );
            }
          } catch (emitErr) {
            logger.warn("Failed to emit socket notification", emitErr);
          }
        }
      }

      // 7️⃣ Return response
      return responseData.success(
        res,
        { appointment, notified: shouldNotify ? recipientsArr : [] },
        messageConstants.DATA_SAVED_SUCCESSFULLY
      );
    } catch (error) {
      console.error("update appointment error:", error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};


const updateAppointment = async (req, res) => {
    return new Promise(async () => {
        try {
            const { reference_id, date, time_slot, visit_type, patient_id, patient_name } = req.body;
            const actorId = req.userDetails?._id;

            // 1. Validate input
            if (!reference_id) {
                return responseData.fail(res, "reference_id is required", 400);
            }

            // 2. Fetch appointment
            const appointment = await AppointmentSchema.findById(reference_id).populate("staff_id");
            if (!appointment) {
                return responseData.fail(res, "Appointment not found", 404);
            }

            // 3. Prepare new values (keep old if not provided)
            const newDate = date || appointment.date;
            const newTimeSlot = time_slot || appointment.time_slot;
            const newVisitType = visit_type || appointment.visit_type;
            const newPatientId = patient_id || appointment.patient_id;

            // const getAllBookingsForDoctor = async (doctorId, from, to) => {
            //     return AppointmentSchema.find({
            //         staff_id: doctorId,
            //         date: { $gte: from, $lte: to }
            //     });
            // };
            // 4. Validate against availability


            const allBookings = await structureAppointmentHelper(appointment.staff_id, newDate, newDate);

            console.log(allBookings, ">>> all the appoitments >>>")

            // helper you already have that returns slots + booked

            const effectiveSlots = buildEffectiveSlots(allBookings, appointment);

            console.log(effectiveSlots, ">> Effective slots")
            // function that merges old appointment slot into available slots

            const { start, end } = newTimeSlot;
            const apptStart = toMinutes(start);
            const apptEnd = toMinutes(end);
            const mergedAvail = mergeSlots(effectiveSlots);

            const isInsideAvailable = mergedAvail.some((a) => {
                const availableStart = toMinutes(a.start);
                const availableEnd = toMinutes(a.end);
                return apptStart >= availableStart && apptEnd <= availableEnd;
            });

            if (!isInsideAvailable) {
                return responseData.fail(
                    res,
                    `Selected time ${start}–${end} is not available for Dr. ${appointment.staff_id.firstname}.`,
                    400
                );
            }

            // 5. Update appointment
            appointment.date = newDate;
            appointment.time_slot = newTimeSlot;
            appointment.visit_type = newVisitType;
            appointment.patient_id = newPatientId;
            appointment.status = AppointmentStatus.CONFIRMED; // reset until doctor confirms
            await appointment.save();

            console.log(newDate, ">> new Date ")

            // 6. Notify doctor
            // const notifPayload = {
            //     sender_id: actorId,
            //     receiver_id: appointment.staff_id._id,
            //     type: NotificationType.APPOINTMENT_UPDATED,
            //     message: `Appointment has been updated to ${moment(newDate).format("YYYY-MM-DD")} (${newTimeSlot.start}-${newTimeSlot.end}). Please confirm.`,
            //     reference_id: appointment._id,
            //     reference_model: "Appointment",
            //     read: false
            // };

            // const notification = await NotificationSchema.create(notifPayload);

            // // emit via socket if doctor is online
            // const io = req.app?.get("socketio");
            // const socketRec = await SocketSchema.findOne({ user_id: appointment.staff_id._id });
            // if (io && socketRec?.socket_id) {
            //     io.to(socketRec.socket_id).emit("appointmentUpdated", {
            //         ...notifPayload,
            //         _id: notification._id,
            //         createdAt: notification.createdAt
            //     });
            // }

            const appointmentDate = new Date(date);
            const formattedDate = `${String(appointmentDate.getDate()).padStart(2, '0')}/${String(appointmentDate.getMonth() + 1).padStart(2, '0')}/${appointmentDate.getFullYear()}`;
            const formatTimeTo12Hour = (timeString) => {
                const [hours, minutes] = timeString.split(':');
                const hour = parseInt(hours);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const twelveHour = hour % 12 || 12;
                return `${twelveHour}:${minutes} ${ampm}`;
            };
            const formattedStartTime = formatTimeTo12Hour(time_slot?.start);
            const formattedEndTime = formatTimeTo12Hour(time_slot?.end);
            const user = await UserSchema?.findOne({ staff_id: appointment?.staff_id });
            const notification = await NotificationSchema.create({
                sender_id: patient_id,
                receiver_id: user?._id,
                type: NotificationType.APPOINTMENT_REQUEST,
                message: `Appointment request from patient ${patient_name} on ${date} (${time_slot})`,
                reference_id: appointment._id,
                reference_model: "Appointment",
                read: false
            });
            const io = req.app.get('socketio');

            const doctorSocket = await SocketSchema.findOne({ user_id: user._id });

            io.to(`${doctorSocket.socket_id}`).emit("appointmentRequest", {
                _id: notification?._id,
                sender_id: patient_id,
                receiver_id: user?._id,
                type: NotificationType.APPOINTMENT_REQUEST,
                // message: `Appointment request from patient ${patient_name} on ${date} (${time_slot?.start}-${time_slot?.end})`,
                message: `Appointment request from patient ${patient_name} on ${formattedDate} (${formattedStartTime}-${formattedEndTime})`,
                reference_id: appointment._id,
                reference_model: "Appointment",
                read: false
            });


            return responseData.success(res, { appointment }, messageConstants.DATA_UPDATED_SUCCESSFULLY);

        } catch (error) {
            console.error("update appointment error:", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};


const updatePatientStatus = async (req, res) => {
  return new Promise(async () => {
    try {
      const { patient_status, message } = req.body;
      const patientId = req.params._id;

      // Validate patientId
      if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
        return responseData.fail(res, "Valid patient ID is required", 400);
      }

      // Validate patient_status
      if (!patient_status || !Object.values(PatientStatus).includes(patient_status)) {
        return responseData.fail(res, "Invalid patient_status", 400);
      }

      // Update patient_status in all appointments for this patient
      const result = await AppointmentSchema.updateMany(
        { patient_id: patientId },
        // { patient_status }
        {
          $set: {
            patient_status,
            patient_message: message || "",
          },
        }
      );

      if (!result || result.matchedCount === 0) {
        return responseData.fail(res, "No appointments found for this patient", 404);
      }

      // Return simplified response
      return responseData.success(
        res,
        {
          patientId,
          patient_status,
          message: message || "",
        },
        messageConstants.DATA_SAVED_SUCCESSFULLY
      );

    } catch (error) {
      logger.error("Update patient status error:", error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};

module.exports = {
    createAppointment,
    getAppontmentByDoctor,
    getAppontmentByPatient,
    getPatients,
    updateAppointmentStatus,
    updateAppointment,
    getAppointmentList,
    updatePatientStatus
}