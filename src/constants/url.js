const urlConstants = {

    // AUTH ROUTES
    USER_SIGNUP: '/auth/signup',
    USER_SIGNIN: '/auth/signin',
    USER_LOGOUT: '/auth/logout',

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

    // USER ROUTES
    GET_ADMIN_LIST: '/admin/list',
    GET_STAFF_LIST:  '/staff/list',
    GET_USER_LIST:   '/user/list',
    GET_USER_PROFILE: '/user/profile',
    UPDATE_USER_PROFILE: '/update/profile',

}

module.exports = urlConstants;