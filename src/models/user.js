const mongoose = require('mongoose');
const { UserTypes } = require('../constants');

const userSchema = mongoose.Schema({
    firstname: {
        type: String,
        required: true
    },
    lastname: {
        type: String,
        required: true
    },

       countryCode: {
        type: String,
        required: true,
        match: [/^\+[1-9][0-9]{0,3}$/, "Please enter a valid country code"] 
    },
    
    phone: {
        type: String,
        required: true,
        unique: true, // mobile compulsory + unique
        match: [/^[0-9]{10}$/, "Please enter a valid mobile number"],
    },
    email: {
        type: String,
        unique: true,
        sparse: true
        // required: true,
        // index: { unique: true }
    },
    password: {
        type: String,
        // required: true
    },
    address: {
        type: String
    },
    country: {
        type: String
    },
    state: {
        type: String
    },
    city: {
        type: String
    },
    gender: {
        type: String,
        enum: ["male", "female", "other"]
    },
    is_online: {
        type: Boolean,
        default: false
    },
    last_seen: {
        type: Date,
        default: Date.now
    },
    token: {
        type: String
    },
    role: {
        type: Number,
        enum: [UserTypes.USER, UserTypes.ADMIN, UserTypes.STAFF],
        required: true
    },
    token: {
        type: String
    },
    created_at: {
        type: Date,
        required: true,
        default: Date.now
    },
    updated_at: {
        type: Date,
        required: true,
        default: Date.now
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    status: {
        type: Number,
        required: true,
        default: 1
    },

});

module.exports = mongoose.model('users', userSchema);