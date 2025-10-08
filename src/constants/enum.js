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

const leaveStatus = Object.freeze({

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

const leaveTypes = Object.freeze({
    FULL_DAY: "FULL_DAY",
    FIRST_HALF: "FIRST_HALF",
    SECOND_HALF: "SECOND_HALF",
});

const NotificationType = Object.freeze({
    APPOINTMENT_REQUEST: "APPOINTMENT_REQUEST",
    APPOINTMENT_CONFIRMED: "APPOINTMENT_CONFIRMED",
    APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
    MESSAGE: "MESSAGE",
    SYSTEM: "SYSTEM",
    LEAVE_REQUEST: "LEAVE_REQUEST",
    LEAVE_CONFIRMED: "LEAVE_CONFIRMED",
    LEAVE_CANCELLED: "LEAVE_CANCELLED",
    ASSIGN_USER: "ASSIGN_USER"
})

const leaveTypeTimes = {
    FULL_DAY: { start: "00:00", end: "23:00" },
    FIRST_HALF: { start: "08:00", end: "14:00" },
    SECOND_HALF: { start: "14:00", end: "20:00" },
};

module.exports = {
    UserRole,
    UserTypes,
    MessageStatus,
    VisitType,
    WeekDays,
    AppointmentStatus,
    defaultWeeklySchedule,
    NotificationType,
    leaveStatus,
    leaveTypes,
    leaveTypeTimes
}