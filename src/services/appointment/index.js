const { UserRole } = require('../../constants');
const { AppointmentStatus, NotificationType } = require('../../constants/enum');
const AppointmentSchema = require('../../models/appointment');
const WeeklyScheduleSchema = require('../../models/weekly_schedule_pattern');
const UserSchema = require('../../models/user')
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
                status: AppointmentStatus?.PENDING
            }
            const appointment = await AppointmentSchema?.create({ ...payload });
            const user = await UserSchema?.findOne({ staff_id });
            console.log(user, "LLL")

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
                appointment,
                message: notification.message,
                notificationId: notification._id
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
const getAppontmentByDoctor = async (req, res) => {
    return new Promise(async () => {

        try {
            const doctorId = req.params._id;
            const { from, to } = req.query; // frontend passes date range

            const startDate = moment(from).startOf("day");
            const endDate = moment(to).endOf("day");

            // 1. Fetch data
            const [appointments, weeklySchedule, leaves] = await Promise.all([
                AppointmentSchema.find({
                    staff_id: doctorId,
                    //start: { $gte: startDate.toDate(), $lte: endDate.toDate() }
                }),
                WeeklyScheduleSchema.findOne({ staff_id: doctorId }),
                StaffLeaveSchema.find({
                    staff_id: doctorId,
                    // start: { $lte: endDate.toDate() },
                    // end: { $gte: startDate.toDate() }
                })
            ]);

            // 2. Build day map
            const dayStatus = {};
            let current = startDate.clone();
            while (current.isSameOrBefore(endDate)) {
                const dateStr = current.format("YYYY-MM-DD");
                dayStatus[dateStr] = { date: dateStr, status: "unavailable", events: [] };
                current.add(1, "day");
            }

            // 3. Mark leaves
            leaves.forEach((leave) => {
                const leaveStart = moment(leave.start).startOf("day");
                const leaveEnd = moment(leave.end).endOf("day");

                Object.keys(dayStatus).forEach((dateStr) => {
                    const d = moment(dateStr);
                    if (d.isBetween(leaveStart, leaveEnd, null, "[]")) {
                        dayStatus[dateStr].status = "leave";
                        dayStatus[dateStr].events.push({
                            title: "Doctor on Leave",
                            start: d.startOf("day").toDate(),
                            end: d.endOf("day").toDate(),
                            type: "leave"
                        });
                    }
                });
            });

            console.log(appointments, ">> appoint ment s");
            // 4. Add appointments
            appointments.forEach((appt) => {
                const dateStr = moment(appt.start).format("YYYY-MM-DD");
                if (dayStatus[dateStr]) {
                    dayStatus[dateStr].events.push({
                        title: `Booked - ${appt.patientName || "Patient"}`,
                        start: appt.time_slot?.start,
                        end: appt?.time_slot?.end,
                        type: "booked",
                        status: appt?.status
                    });
                    // only mark as available if not on leave
                    if (dayStatus[dateStr].status !== "leave") {
                        dayStatus[dateStr].status = "available"; // doctor has schedule + bookings
                    }
                }
            });

            // 5. Apply weekly schedule (mark available days)
            if (weeklySchedule) {
                Object.keys(dayStatus).forEach((dateStr) => {
                    const dayOfWeek = moment(dateStr).format("dddd").toLowerCase(); // monday, tuesday...
                    const slots = weeklySchedule[dayOfWeek]; // assume stored as { monday: [{start,end}], ... }

                    if (slots && slots.length > 0 && dayStatus[dateStr].status !== "leave") {
                        // If doctor works this day → mark available if no events yet
                        if (dayStatus[dateStr].events.length === 0) {
                            dayStatus[dateStr].status = "available";
                        }
                    }
                });
            }

            return responseData.success(
                res,
                Object.values(dayStatus),
                messageConstants.FETCHED_SUCCESSFULLY
            );
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

module.exports = {
    createAppointment,
    getAppontmentByDoctor,
    getPatients
}