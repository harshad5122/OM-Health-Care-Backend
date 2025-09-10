const { UserRole } = require('../../constants');
const { AppointmentStatus, NotificationType } = require('../../constants/enum');
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
                created_by: userDetails?.role == UserRole.ADMIN ? "ADMIN" : "USER",
                status: AppointmentStatus?.PENDING,
                creator: userDetails?._id
            }
            const appointment = await AppointmentSchema?.create({ ...payload });
            const user = await UserSchema?.findOne({ staff_id });

            const notification = await NotificationSchema.create({
                sender_id: patient_id,
                receiver_id: user?._id,
                type: NotificationType.APPOINTMENT_REQUEST,
                message: `New appointment request from patient ${patient_name} on ${date} (${time_slot})`,
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
                message: `New appointment request from patient ${patient_name} on ${date} (${time_slot})`,
                reference_id: appointment._id,
                reference_model: "Appointment",
                read: false
            });


            logger.info(
                "Appointment created successfully",
                { appointment: appointment?._id }
            );


            return responseData.success(
                res,
                appointment, // return both if you want
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
const toMinutes = (time) => {
    const m = moment(time, "HH:mm");
    return m.hours() * 60 + m.minutes();
};

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
const formatSlots = (intervals) => {
    return intervals.map(([start, end]) => ({
        start: moment().startOf("day").add(start, "minutes").format("HH:mm"),
        end: moment().startOf("day").add(end, "minutes").format("HH:mm"),
    }));
};

const normalizeSchedule = (slots) => {
    return slots.map(slot => [toMinutes(slot.start), toMinutes(slot.end)]);
};

const getAppontmentByDoctor = async (req, res) => {
    return new Promise(async () => {

        try {
            const doctorId = req.params._id;
            const { from, to } = req.query;

            // Build query — filter by date only if both from+to provided
            const query = { staff_id: doctorId, status: { $ne: AppointmentStatus?.CANCELLED } };
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
                leaves.forEach((leave) => {
                    const leaveStart = moment(leave.start).startOf("day");
                    const leaveEnd = moment(leave.end).endOf("day");
                    Object.keys(dayStatus).forEach((dateStr) => {
                        const d = moment(dateStr, "YYYY-MM-DD");
                        if (d.isBetween(leaveStart, leaveEnd, null, "[]")) {
                            dayStatus[dateStr].status = "leave";
                            dayStatus[dateStr].events.push({
                                title: "Doctor on Leave",
                                start: d.startOf("day").toDate(),
                                end: d.endOf("day").toDate(),
                                type: "leave",
                            });
                        }
                    });
                });



                // Add appointments into correct day bucket using appt.date
                appointments.forEach((appt) => {
                    const dateStr = getApptDateStr(appt); // guaranteed to be string or null
                    if (!dateStr) return; // skip malformed appt without date
                    if (!dayStatus[dateStr]) return; // appointment outside requested range
                    dayStatus[dateStr].events.push({
                        title: `Booked - ${appt.patientName || appt.patient_name || "Patient"}`,
                        start: appt.time_slot?.start, // you may convert to full Date when required by frontend
                        end: appt.time_slot?.end,
                        type: "booked",
                        status: appt?.status,
                        id: appt?._id,
                    });
                    if (dayStatus[dateStr].status !== "leave") {
                        dayStatus[dateStr].status = "available";
                    }
                });

                // Apply weekly schedule marking if day has no events
                if (weeklySchedule) {
                    Object.keys(dayStatus).forEach((dateStr) => {
                        if (dayStatus[dateStr].status === "leave") return;
                        const dayOfWeek = moment(dateStr).format("dddd").toLowerCase(); // monday...
                        const slots = weeklySchedule[dayOfWeek];
                        if (slots && slots.length > 0 && dayStatus[dateStr].events.length === 0) {
                            dayStatus[dateStr].status = "available";
                        }
                    });
                }

                return responseData.success(res, Object.values(dayStatus), messageConstants.FETCHED_SUCCESSFULLY);
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

                return responseData.success(res, Object.values(dayStatus), messageConstants.FETCHED_SUCCESSFULLY);
            }
        } catch (error) {
            console.error("getAppointmentByDoctor error:", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }

    })

}

const getPatients = async (req, res) => {
    return new Promise(async () => {

        try {
            const patients = await UserSchema?.find({
                role: UserRole.USER
            })

            return responseData.success(
                res,
                patients,
                messageConstants.FETCHED_SUCCESSFULLY
            );
        } catch (error) {
            console.error("get patients error:", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    })
}

const updateAppointmentStatus = async (req, res) => {
    return new Promise(async () => {
        try {
            const { reference_id, sender_id, status, message, notification_id } = req?.body
            const actorId = req.userDetails?._id;

            // 1. validate input
            if (!reference_id) {
                return responseData.fail(res, "reference_id is required", 400);
            }
            if (!status || ![AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED].includes(status)) {
                return responseData.fail(res, "Invalid status. Must be CONFIRMED or CANCELLED.", 400);
            }

            // 2. fetch appointment
            const appointment = await AppointmentSchema.findByIdAndUpdate(
                reference_id,
                { status }, // update only status
                { new: true } // return updated doc
            );
            if (!appointment) {
                return responseData.fail(res, "Appointment not found", 404);
            }

            // 3. update status


            // 4. mark original notification (if provided) as read/handled
            if (notification_id) {
                try {
                    await NotificationSchema.findByIdAndUpdate(notification_id, { read: true });
                } catch (err) {
                    logger.warn("Failed to mark original notification as read", err);
                }
            }

            // 5. build recipients set
            // sender_id (from payload) is expected to be the original requester (patient/admin)
            // appointment.creator is authoritative fallback
            const recipients = new Set();
            if (sender_id) recipients.add(String(sender_id));
            if (appointment.creator) recipients.add(appointment.creator.toString());
            // remove actor (doctor) from recipients if present
            if (actorId) recipients.delete(String(actorId));

            const recipientsArr = Array.from(recipients);

            // 6. determine notification type and default message
            const notifType = status === AppointmentStatus.CONFIRMED
                ? (NotificationType?.APPOINTMENT_CONFIRMED || "APPOINTMENT_CONFIRMED")
                : (NotificationType?.APPOINTMENT_CANCELLED || NotificationType?.APPOINTMENT_DECLINED || "APPOINTMENT_CANCELLED");

            const defaultMsg = status === AppointmentStatus.CONFIRMED
                ? `Your appointment on ${appointment.date.toDateString()} (${appointment.time_slot?.start || ""} - ${appointment.time_slot?.end || ""}) has been confirmed.`
                : `Your appointment on ${appointment.date.toDateString()} (${appointment.time_slot?.start || ""} - ${appointment.time_slot?.end || ""}) has been declined.`;

            // 7. create notifications (one per user) and emit via socket if online
            const createdNotifications = [];
            const io = req.app?.get("socketio"); // your socket instance (may be undefined in some tests)

            for (const receiverId of recipientsArr) {
                const notifPayload = {
                    sender_id: actorId || null,         // doctor who acted
                    receiver_id: receiverId,
                    type: notifType,
                    message: defaultMsg,
                    reference_id: appointment._id,
                    reference_model: "Appointment",
                    read: false,
                    reason: message
                };

                const created = await NotificationSchema.create(notifPayload);
                createdNotifications.push(created);

                const emitPayload = {
                    ...notifPayload,
                    _id: created._id,     // include DB id
                    createdAt: created.createdAt
                };

                // send realtime if socket info available
                try {
                    // try to find socket record for receiver
                    const socketRec = await SocketSchema.findOne({ user_id: receiverId });

                    if (io && socketRec && socketRec.socket_id) {
                        // emit directly to that socket id (recommended in your setup)
                        io.to(socketRec.socket_id).emit("appointmentStatusUpdated", emitPayload);
                    } else if (io) {
                        // optional: if you also join user rooms (userId) you could do:
                        // io.to(String(receiverId)).emit(...)
                        // or skip if offline
                        logger.info(`Recipient ${receiverId} not connected via socket (socketRec missing). Notification saved to DB.`);
                    }
                } catch (emitErr) {
                    logger.warn("Failed to emit socket notification", emitErr);
                }
            }

            // 8. return result
            return responseData.success(res, { appointment, notified: recipientsArr }, messageConstants.DATA_SAVED_SUCCESSFULLY);


        } catch (error) {
            console.error("update appointment error:", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    })
}

module.exports = {
    createAppointment,
    getAppontmentByDoctor,
    getPatients,
    updateAppointmentStatus
}