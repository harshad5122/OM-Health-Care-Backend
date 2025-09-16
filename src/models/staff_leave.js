const mongoose = require("mongoose");
const { leaveStatus, leaveTypes } = require("../constants/enum");

const LeaveSlotSchema = new mongoose.Schema({
    start: { type: String },   // optional if partial leave
    end: { type: String }
});

const StaffLeaveSchema = new mongoose.Schema(
    {
        staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "staff", required: true },
        start_date: { type: Date, required: true },   // leave start date
        end_date: { type: Date, required: true },     // leave end date

        // Optional for hourly leaves (within a day)
        start_time: { type: String },   // "HH:mm"
        end_time: { type: String },     // "HH:mm"

        reason: { type: String },
        // full_day: { type: Boolean, default: false },
        leave_type: {
            type: String,
            enum: Object.values(leaveTypes),
            default: leaveTypes.FULL_DAY,
        },
        status: {
            type: String,
            enum: Object.values(leaveStatus),
            default: leaveStatus.PENDING
        }

    },
    { timestamps: true }
);

module.exports = mongoose.model("staff_leave", StaffLeaveSchema);
