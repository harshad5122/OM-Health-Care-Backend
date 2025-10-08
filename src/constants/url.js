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
    GET_BROADCASTS: '/broadcasts',
    GET_BROADCAST_RECIPIENTS: '/broadcasts/recipients/:id',

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
    GET_ALL_CHAT_USER: '/chat/users',

    //STAFF ROUTES
    ADD_DOCTOR: '/add/doctor',
    GET_DOCTOR: '/get/doctor',
    EDIT_DOCTOR: '/edit/doctor/:_id',
    DELETE_DOCTOR: '/delete/doctor/:_id',

    GET_DOCTOR_BY_ID: '/get/doctor/:_id',

    CREATE_APPPOINTMENT: '/create-appointment',
    GET_APPOINTMENT_BY_DOCTOR: '/get-appointment-by-doctor/:_id',
    GET_APPOINTMENT_BY_PATIENT: '/get-appointment-by-patient/:doctor_id/:patient_id',
    GET_APPOINTMENT_LIST:'/get-appointment-list/:_id',
    GET_PATIENTS: '/get-patients',
    UPDATE_APPOINTMENT_STATUS: '/update-status',
    UPDATE_APPOINTMENT: '/update-appointment',

    GET_NOTIFICATION: '/notification',
    MAEK_SEEN: '/mark-seen/:_id',

    CREATE_LEAVE:'/create-leave',
    GET_LEAVE_BY_DOCTOR:'/get-leave/:_id',
    UPDATE_LEAVE_STATUS:'/update-leave-status',
    UPDATE_LEAVE: '/update-leave/:_id',
    DELETE_LEAVE: '/delete-leave/:_id',

}

module.exports = urlConstants;