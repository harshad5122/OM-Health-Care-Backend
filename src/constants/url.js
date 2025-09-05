const urlConstants = {

    // AUTH ROUTES
    USER_SIGNUP: '/auth/signup',
    USER_SIGNIN: '/auth/signin',
    VERIFY_OTP: '/auth/verify-otp',
    USER_LOGOUT: '/auth/logout',
    USER_CHANGE: '/auth/change-password',



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
    GET_STAFF_LIST: '/staff/list',
    GET_USER_LIST: '/user/list',
    GET_USER_PROFILE: '/user/profile',
    UPDATE_USER_PROFILE: '/update/profile',
    EDIT_USER: '/edit/user/:_id',
    DELETE_USER: '/delete/user/:_id',
    USER_ADD: '/user/add',
    GET_USER_BY_ID: '/user/:_id',

    //STAFF ROUTES
    ADD_DOCTOR: '/add/doctor',
    GET_DOCTOR: '/get/doctor',
    EDIT_DOCTOR: '/edit/doctor/:_id',
    DELETE_DOCTOR: '/delete/doctor/:_id',

    GET_DOCTOR_BY_ID: '/get/doctor/:_id'
}

module.exports = urlConstants;