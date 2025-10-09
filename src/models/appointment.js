const mongoose = require("mongoose");
const { AppointmentStatus, VisitType, PatientStatus } = require('../constants/enum')

const AppointmentSchema = new mongoose.Schema(
    {
        staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "staff", required: true },
        patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
        date: { type: Date, required: true },
        time_slot: {
            start: { type: String, required: true },
            end: { type: String, required: true }
        },
        visit_type: { type: String, enum: Object.values(VisitType), required: true },
        status: {
            type: String,
            enum: Object.values(AppointmentStatus),
            default: AppointmentStatus.CONFIRMED
        },
        patient_status: {
            type: String,
            enum: Object.values(PatientStatus),
            default: PatientStatus.CONTINUE
        },
        created_by: {
            type: String,
            enum: ["ADMIN", "DOCTOR"]
        },
        creator: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("appointment", AppointmentSchema);
