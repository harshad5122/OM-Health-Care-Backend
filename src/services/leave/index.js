
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
      const { staff_id, staff_name, start_date, end_date, leave_type, start_time, end_time, reason,admin_id,admin_name} = req.body;

      if (!staff_id || !start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: "Staff ID, start_date, and end_date are required."
        });
      }

      // Normalize dates
      const startDate = dayjs(start_date).startOf("day").toDate();
      const endDate = dayjs(end_date).endOf("day").toDate();

      if (dayjs(endDate).isBefore(startDate)) {
        return res.status(400).json({
          success: false,
          message: "End date cannot be earlier than start date."
        });
      }

      // Default leave data
      let leaveData = {
        staff_id,
        start_date: startDate,
        end_date: endDate,
        reason,
        leave_type,
        admin_id,
        admin_name
      };



      // Save to DB
      const leave = new StaffLeaveSchema(leaveData);
      await leave.save();

      // Notify admins
      // const admins = await UserSchema.find({ role: 2 });

      // await Promise.all(
      //   admins.map(async (admin) => {
      //     const notification = await NotificationSchema.create({
      //       sender_id: staff_id,
      //       receiver_id: admin._id,
      //       type: NotificationType.LEAVE_REQUEST,
      //       message: `New leave request from staff ${staff_name} (${leave_type}) from ${dayjs(startDate).format("YYYY-MM-DD")} to ${dayjs(endDate).format("YYYY-MM-DD")}`,
      //       reference_id: leave._id,
      //       reference_model: "StaffLeave",
      //       read: false
      //     });

      //     // Emit via socket if admin is online
      //     const io = req.app.get("socketio");
      //     const adminSocket = await SocketSchema.findOne({ user_id: admin._id });

      //     if (adminSocket?.socket_id) {
      //       io.to(adminSocket.socket_id).emit("leaveRequest", {
      //         _id: notification._id,
      //         sender_id: staff_id,
      //         receiver_id: admin._id,
      //         type: NotificationType.LEAVE_REQUEST,
      //         message: notification.message,
      //         reference_id: leave._id,
      //         reference_model: "StaffLeave",
      //         read: false
      //       });
      //     }

      //     return notification;
      //   })
      // );



      const admin = await UserSchema.findById(admin_id);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found."
        });
      }
      const notification = await NotificationSchema.create({
        sender_id: staff_id,
        receiver_id: admin._id,
        type: NotificationType.LEAVE_REQUEST,
        message: `New leave request from ${staff_name} (${leave_type}) from ${dayjs(startDate).format("DD-MM-YYYY")} to ${dayjs(endDate).format("DD-MM-YYYY")}`,
        reference_id: leave._id,
        reference_model: "StaffLeave",
        read: false
      });
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

      logger.info("Leave request created successfully", { leave: leave?._id });

      return responseData.success(res, leave, messageConstants.DATA_SAVED_SUCCESSFULLY);

    } catch (error) {
      console.error("createLeave error:", error);
      logger.error("Create leave " + messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};


const getLeavesByProvider = async (req, res) => {
  return new Promise(async () => {
    try {
      const staff_id = req.params?._id;  // provider ID from URL
      const { from, to  } = req.query; // optional filters

      if (!staff_id) {
        return res.status(400).json({
          success: false,
          message: "Staff ID is required.",
        });
      }

      let query = { staff_id };

      // optional date range filter
      // if (start_date && end_date) {
      //   query.$or = [
      //     {
      //       start_date: { $lte: new Date(end_date) },
      //       end_date: { $gte: new Date(start_date) },
      //     }
      //   ];
      // }

      if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);

      query.$or = [
        {
          start_date: { $lte: toDate },
          end_date: { $gte: fromDate },
        },
      ];
    }

      const leaves = await StaffLeaveSchema.find(query)
        .sort({ createdAt: -1 })
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
        : (NotificationType?.LEAVE_CANCELLED || NotificationType?.LEAVE_CANCELLED || "LEAVE_CANCELLED");

      // const startDate = new Date(leave.start_date).toDateString();
      const startDate = dayjs(leave.start_date).format("DD-MM-YYYY")
      // const endDate = new Date(leave.end_date).toDateString();
      const endDate = dayjs(leave.end_date).format("DD-MM-YYYY")

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

const updateLeave = async (req, res) => {
  return new Promise(async () => {
    try {
      const { _id } = req.params;
      const { start_date, end_date, leave_type, reason,admin_id, admin_name } = req.body;

      if (!_id) {
        return responseData.fail(res, "Leave ID is required", 400);
      }

      const leave = await StaffLeaveSchema.findById(_id);
      if (!leave) {
        return responseData.fail(res, "Leave not found", 404);
      }

      // Normalize new dates if provided
      let startDate = leave.start_date;
      let endDate = leave.end_date;

      if (start_date) startDate = dayjs(start_date).startOf("day").toDate();
      if (end_date) endDate = dayjs(end_date).endOf("day").toDate();

      if (dayjs(endDate).isBefore(startDate)) {
        return responseData.fail(res, "End date cannot be earlier than start date.", 400);
      }

      // Update fields
      leave.start_date = startDate;
      leave.end_date = endDate;
      leave.leave_type = leave_type || leave.leave_type;
      leave.reason = reason || leave.reason;
      if (admin_id) leave.admin_id = admin_id;
      if (admin_name) leave.admin_name = admin_name;

      await leave.save();

      logger.info("Leave updated successfully", { leave: leave?._id });
      return responseData.success(res, leave, messageConstants.DATA_UPDATED_SUCCESSFULLY);

    } catch (error) {
      console.error("updateLeave error:", error);
      logger.error("Update leave " + messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};

const deleteLeave = async (req, res) => {
  return new Promise(async () => {
    try {
      const { _id } = req.params;

      if (!_id) {
        return responseData.fail(res, "Leave ID is required", 400);
      }

      const leave = await StaffLeaveSchema.findById(_id);
      if (!leave) {
        return responseData.fail(res, "Leave not found", 404);
      }

      await StaffLeaveSchema.findByIdAndDelete(_id);

      // Optionally delete related notifications
      await NotificationSchema.deleteMany({ reference_id: _id, reference_model: "StaffLeave" });

      logger.info("Leave deleted successfully", { leaveId: _id });
      return responseData.success(res, {}, messageConstants.DATA_DELETED_SUCCESSFULLY);

    } catch (error) {
      console.error("deleteLeave error:", error);
      logger.error("Delete leave " + messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};

module.exports = {
  createLeave,
  getLeavesByProvider,
  updateLeaveStatus,
  updateLeave,
  deleteLeave
}