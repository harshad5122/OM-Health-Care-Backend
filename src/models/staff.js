// models/staff.js
const mongoose = require("mongoose");
const { UserTypes } = require('../constants');

const staffSchema = new mongoose.Schema(
    {

        firstname: {
            type: String,
            required: true,
        },
        lastname: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        countryCode: {
            type: String,
            required: true,
            match: [/^\+[1-9][0-9]{0,3}$/, "Please enter a valid country code"],
        },
        phone: {
            type: String,
            required: true,
            unique: true,
            match: [/^[0-9]{10}$/, "Please enter a valid mobile number"],
        },
        dob: {
            type: Date,
        },
        gender: {
            type: String,
            enum: ["male", "female", "other", "prefer not to say"],
        },

         role: {
        type: Number,
        enum: [UserTypes.STAFF],
        required: true
    },

        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, required: true },
        pincode: {
            type: String,
            required: true,
            match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
        },

        qualification: { type: String }, 
        specialization: { type: String },
        occupation: { type: String },

         professionalStatus: {
            type: String,
            enum: ["fresher", "experienced"],
            default: "experienced",
        },


 workExperience: {
        // professionalStatus: {
        //     type: String,
        //     enum: ["fresher", "experienced"],
        //     default: "experienced",
        // },
        // qualification: { type: String }, 
        // specialization: { type: String },
        // occupation: { type: String },

        // If experienced
        totalYears: { type: Number, min: 0 },
        lastHospital: { type: String },
        position: { type: String },
        workAddress: {
            hospitalName: { type: String },
            line1: { type: String },
            city: { type: String },
            state: { type: String },
            country: { type: String },
            pincode: {
                type: String,
                match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
            },
        },
    },

         familyDetails: {

        father: {
            name: { type: String },
            contact: {
                type: String,
                match: [/^[0-9]{10}$/, "Please enter a valid mobile number"],
            },
            occupation: { type: String },
        },
        mother: {
            name: { type: String },
            contact: {
                type: String,
                match: [/^[0-9]{10}$/, "Please enter a valid mobile number"],
            },
            occupation: { type: String },
        },
        permanentAddress: {
            line1: { type: String },
            line2: { type: String },
            city: { type: String },
            state: { type: String },
            country: { type: String, default: "India" },
            pincode: {
                type: String,
                match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
            },
        },
        currentAddress: {
            line1: { type: String },
            line2: { type: String },
            city: { type: String },
            state: { type: String },
            country: { type: String, default: "India" },
            pincode: {
                type: String,
                match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
            },
        },
        sameAsPermanent: {
            type: Boolean,
            default: false,
        },
        emergencyContact: {
            name: { type: String, required: true },
            relation: {
                type: String,
                // enum: ["spouse", "parent", "sibling", "other"],
                required: true,
            },
            contact: {
                type: String,
                required: true,
                match: [/^[0-9]{10}$/, "Please enter a valid mobile number"],
            },
        },
    },

        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
        is_deleted: { type: Boolean, default: false },
        status: { type: Number, default: 1 },
    },
    
);

module.exports = mongoose.model("Staff", staffSchema);
