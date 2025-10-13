const mongoose = require('mongoose');
const { NotificationType } = require('../constants/enum');

const NotificationSchema = new mongoose.Schema(
    {
        sender_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",          // doctor or patient receiving notification
            required: true,
        },
        receiver_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",          // doctor or patient receiving notification
            required: true,
        },
        type: {
            type: String,
            enum: Object?.keys(NotificationType),
            default: "SYSTEM",
        },
        message: {
            type: String,
            required: true,
        },
        reference_id: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: "reference_model",
        },
        reference_model: {
            type: String,
            enum: ["Appointment", "Message", "Other","StaffLeave", "User"],
        },
        read: {
            type: Boolean,
            default: false,
        },
        is_deleted: {
            type: Boolean,
            default: false,
        }


    },
    { timestamps: true }
);

module.exports = mongoose.model("notification", NotificationSchema);
