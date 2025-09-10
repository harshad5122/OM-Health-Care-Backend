const UserRole = Object.freeze({
    USER: 1,
    ADMIN: 2,
});

const UserTypes = Object.freeze({
    USER: 1,
    ADMIN: 2,
    STAFF: 3,
});

const MessageStatus = Object.freeze({
    SENT: 'sent',
    DELIVERED: 'delivered',
    SEEN: 'seen'
});

const VisitType = Object.freeze({
    CLINIC: "CLINIC",
    HOME: "HOME"
})

const WeekDays = Object.freeze({
    MONDAY: "MONDAY",
    TUESDAY: "TUESDAY",
    WEDNESDAY: "WEDNESDAY",
    THURSDAY: "THURSDAY",
    FRIDAY: "FRIDAY",
    SATURDAY: "SATURDAY",
    SUNDAY: "SUNDAY"
});

const AppointmentStatus = Object.freeze({
    BOOKED: "BOOKED",
    PENDING: "PENDING",
    CONFIRMED: "CONFIRMED",
    CANCELLED: "CANCELLED"
});
const defaultWeeklySchedule = Object.values(WeekDays).map(day => ({
    day,
    time_slots: [
        { start: "08:00", end: "20:00", visit_type: VisitType.CLINIC }
    ]
}));

const NotificationType = Object.freeze({
    APPOINTMENT_REQUEST: "APPOINTMENT_REQUEST",
    APPOINTMENT_CONFIRMED: "APPOINTMENT_CONFIRMED",
    APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
    MESSAGE: "MESSAGE",
    SYSTEM: "SYSTEM"
})

module.exports = {
    UserRole,
    UserTypes,
    MessageStatus,
    VisitType,
    WeekDays,
    AppointmentStatus,
    defaultWeeklySchedule,
    NotificationType
}