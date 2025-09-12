
const { responseData, messageConstants, mailTemplateConstants, mailSubjectConstants } = require('../../constants');
const { NotificationType } = require('../../constants/enum');
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
  

module.exports = {
    createLeave,
    getLeavesByProvider
}