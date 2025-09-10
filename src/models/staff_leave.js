const mongoose = require("mongoose");

const LeaveSlotSchema = new mongoose.Schema({
    start: { type: String },   // optional if partial leave
    end: { type: String }
});

const StaffLeaveSchema = new mongoose.Schema(
    {
        staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "staff", required: true },
        date: { type: Date, required: true },   // specific leave date
        reason: { type: String },
        full_day: { type: Boolean, default: false },
        blocked_slots: [LeaveSlotSchema]   // if doctor unavailable for part of the day
    },
    { timestamps: true }
);

module.exports = mongoose.model("staff_leave", StaffLeaveSchema);
