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

module.exports = {
    UserRole,
    UserTypes,
    MessageStatus
}