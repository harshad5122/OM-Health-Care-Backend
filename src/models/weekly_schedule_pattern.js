const mongoose = require("mongoose");
const { VisitType, WeekDays } = require('../constants/enum');

const TimeSlotSchema = new mongoose.Schema({
    start: { type: String, required: true },
    end: { type: String, required: true },
    visit_type: { type: String, enum: Object.values(VisitType), default: VisitType?.CLINIC, required: true }
});

const DayScheduleSchema = new mongoose.Schema({
    day: {
        type: String,
        enum: Object.values(WeekDays),
        required: true
    },
    time_slots: [TimeSlotSchema]
});

const WeeklyScheduleSchema = new mongoose.Schema(
    {
        staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
        weekly_schedule: [DayScheduleSchema]
    },
    { timestamps: true }
);

module.exports = mongoose.model("weekly-schedule", WeeklyScheduleSchema);
