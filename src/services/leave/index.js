
const { responseData, messageConstants, mailTemplateConstants, mailSubjectConstants } = require('../../constants');
const { NotificationType, leaveStatus } = require('../../constants/enum');
const NotificationSchema = require('../../models/notification')
const StaffLeaveSchema = require('../../models/staff_leave')
const SocketSchema = require('../../models/socket')
const UserSchema = require('../../models/user')
const dayjs = require("dayjs");
const { logger } = require('../../utils');



const createLeave = async (req, res) => {
    return new Promise(async () => {
    try {
        const { staff_id,staff_name, start_date, end_date, start_time, end_time, full_day, reason } = req.body;

        if (!staff_id || !start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: "Staff ID, start_date, and end_date are required."
            });
        }

        // Normalize dates (strip time part, store as start of day)
        const startDate = dayjs(start_date).startOf("day").toDate();
        const endDate = dayjs(end_date).endOf("day").toDate();

        if (dayjs(endDate).isBefore(startDate)) {
            return res.status(400).json({
                success: false,
                message: "End date cannot be earlier than start date."
            });
        }

        // Validation for hourly leave
        let leaveData = {
            staff_id,
            start_date: startDate,
            end_date: endDate,
            reason,
            full_day: !!full_day
        };

        if (!full_day) {
            if (!start_time || !end_time) {
                return res.status(400).json({
                    success: false,
                    message: "Start time and end time are required for partial leave."
                });
            }

            // Validate time format (HH:mm) and ordering
            const [sh, sm] = start_time.split(":").map(Number);
            const [eh, em] = end_time.split(":").map(Number);

            const startMins = sh * 60 + sm;
            const endMins = eh * 60 + em;

            if (endMins <= startMins && dayjs(startDate).isSame(endDate, "day")) {
                return res.status(400).json({
                    success: false,
                    message: "End time must be later than start time for same-day partial leave."
                });
            }

            leaveData.start_time = start_time;
            leaveData.end_time = end_time;
        }

        // Save to DB
        const leave = new StaffLeaveSchema(leaveData);
        await leave.save();

        const admins = await UserSchema.find({ role: 2 });
        // const user = await UserSchema?.findOne({ staff_id });
// console.log(user,staff_id,">>LLL")
        const notifications = await Promise.all(
            admins.map(async (admin) => {
              const notification = await NotificationSchema.create({
                sender_id: staff_id,
                receiver_id: admin._id,
                type: NotificationType.LEAVE_REQUEST,
                message: `New leave request from staff ${staff_name} from ${dayjs(startDate).format("YYYY-MM-DD")} to ${dayjs(endDate).format("YYYY-MM-DD")}`,
                reference_id: leave._id,
                reference_model: "StaffLeave",
                read: false
              });
      
              // Emit via socket if admin is online
              const io = req.app.get("socketio");
              const adminSocket = await SocketSchema.findOne({ user_id: admin._id });
      
              if (adminSocket?.socket_id) {
                io.to(adminSocket.socket_id).emit("leaveRequest", {
                  _id: notification._id,
                  sender_id: staff_id,
                  receiver_id: admin._id,
                  type: NotificationType.LEAVE_REQUEST,
                  message: notification.message,
                  reference_id: leave._id,
                  reference_model: "StaffLeave",
                  read: false
                });
              }
      
              return notification;
            })
          );
        logger.info(
            "Leave requiest created successfully",
            { leave: leave?._id }
        );
        return responseData.success(
           res,
             leave,
             messageConstants.DATA_SAVED_SUCCESSFULLY
        );
    } catch (error) {
        console.error("createLeave error:", error);
        logger.error("Create appointment " + messageConstants.INTERNAL_SERVER_ERROR, error);
        return responseData.fail(
            res,
            messageConstants.INTERNAL_SERVER_ERROR,
            500
        );
    }
});
};

const getLeavesByProvider = async (req, res) => {
    return new Promise(async () => {
    try {
      const  staff_id  = req.params?._id;  // provider ID from URL
      const { start_date, end_date } = req.query; // optional filters
  
      if (!staff_id) {
        return res.status(400).json({
          success: false,
          message: "Staff ID is required.",
        });
      }
  
      let query = { staff_id };
  
      // optional date range filter
      if (start_date && end_date) {
        query.$or = [
          {
            start_date: { $lte: new Date(end_date) },
            end_date: { $gte: new Date(start_date) },
          }
        ];
      }
  
      const leaves = await StaffLeaveSchema.find(query)
        .sort({ start_date: 1 })
        .lean();
  
      return responseData.success(
        res,
        leaves,
        messageConstants.FETCHED_SUCCESSFULLY
      );
    } catch (error) {
      console.error("getLeavesByProvider error:", error);
      logger.error("getLeavesByProvider " + messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(
        res,
        messageConstants.INTERNAL_SERVER_ERROR,
        500
      );
    }
})
  };
  
  const updateLeaveStatus = async (req, res) => {
    return new Promise(async () => {
        try {
            const { reference_id, sender_id, status, message, notification_id } = req?.body
            const actorId = req.userDetails?._id;

            // 1. validate input
            if (!reference_id) {
                return responseData.fail(res, "reference_id is required", 400);
            }
            if (!status || ![leaveStatus.CONFIRMED, leaveStatus.CANCELLED].includes(status)) {
                return responseData.fail(res, "Invalid status. Must be CONFIRMED or CANCELLED.", 400);
            }

            // 2. fetch appointment
            const leave = await StaffLeaveSchema.findByIdAndUpdate(
                reference_id,
                { status }, // update only status
                { new: true } // return updated doc
            );
            if (!leaveStatus) {
                return responseData.fail(res, "Leave not found", 404);
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
            
           
            // 6. determine notification type and default message
            const notifType = status === leaveStatus.CONFIRMED
                ? (NotificationType?.LEAVE_CONFIRMED || "LEAVE_CONFIRMED")
                : (NotificationType?.LEAVE_CANCELED || NotificationType?.LEAVE_CANCELED || "LEAVE_CANCELLED");

                const startDate = new Date(leave.start_date).toDateString();
                const endDate = new Date(leave.end_date).toDateString();
                
                const dateRange =
                  startDate === endDate ? startDate : `${startDate} to ${endDate}`;
                
                const timeRange = leave.full_day ? "" : ` (${leave.start_time} - ${leave.end_time})`;
                
                const defaultMsg =
                  status === leaveStatus.CONFIRMED
                    ? `Your leave from ${dateRange}${timeRange} has been confirmed.`
                    : `Your leave from ${dateRange}${timeRange} has been declined.`;

            // 7. create notifications (one per user) and emit via socket if online
            const createdNotifications = [];
            const io = req.app?.get("socketio"); // your socket instance (may be undefined in some tests)

           
                const notifPayload = {
                    sender_id: actorId || null,         // doctor who acted
                    receiver_id: sender_id,
                    type: notifType,
                    message: defaultMsg,
                    reference_id: leave._id,
                    reference_model: "StaffLeave",
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
                    const socketRec = await SocketSchema.findOne({ user_id: sender_id });

                    if (io && socketRec && socketRec.socket_id) {
                        // emit directly to that socket id (recommended in your setup)
                        io.to(socketRec.socket_id).emit("leaveStatusUpdated", emitPayload);
                    } else if (io) {
                        // optional: if you also join user rooms (userId) you could do:
                        // io.to(String(receiverId)).emit(...)
                        // or skip if offline
                        logger.info(`Recipient ${sender_id} not connected via socket (socketRec missing). Notification saved to DB.`);
                    }
                } catch (emitErr) {
                    logger.warn("Failed to emit socket notification", emitErr);
                }
       

            // 8. return result
            return responseData.success(res, { leave, notified: sender_id }, messageConstants.DATA_SAVED_SUCCESSFULLY);


        } catch (error) {
            console.error("update appointment error:", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    })
}

module.exports = {
    createLeave,
    getLeavesByProvider,
    updateLeaveStatus
}