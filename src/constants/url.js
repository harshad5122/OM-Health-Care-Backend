const urlConstants = {

    // AUTH ROUTES
    USER_SIGNUP: '/auth/signup',
    USER_SIGNIN: '/auth/signin',

    // MESSAGE ROUTES
    SEND_MESSAGE: '/message/send',
    GET_MESSAGE: '/message/get/:senderId/:receiverId',
    MESSAGE_LIST: '/message/list',
    CHAT_LIST: '/chat/list',
    GROUP_MESSAGE_LIST: '/gruop-message/list',

    // UPLOAD_FILE ROUTES
    UPLOAD_FILE: '/file/upload',

    // CREATE_ROOM ROUTES
    CREATE_ROOM: '/room/create',
    UPDATE_ROOM: '/room/update/:id',
    CREATE_ADMIN: '/room/admin/create',
    REMOVE_ADMIN: '/room/admin/remove',
    GET_ROOM_MEMBERS: '/room/members/:roomId',
}

module.exports = urlConstants;