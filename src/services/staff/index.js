const StaffSchema = require('../../models/staff');
const UserSchema = require('../../models/user');
const { responseData, messageConstants } = require('../../constants');
const { logger } = require('../../utils');
const { UserTypes } = require('../../constants/enum');
const { createUser, editUser } = require('../../services/user');
const { default: mongoose } = require('mongoose');


const addDoctor = async (req, userDetails, res) => {
  return new Promise(async () => {
    try {
      const bodyData = req.body;

      bodyData.role = UserTypes.STAFF;

      // 🔍 Check if staff already exists by email or phone
      const existingStaff = await StaffSchema.findOne({
        $or: [{ email: bodyData.email }, { phone: bodyData.phone }],
      });

      if (existingStaff) {
        logger.error(
          `Staff with email ${bodyData.email} or phone ${bodyData.phone} already exists`
        );
        return responseData.fail(
          res,
          "Staff already exists with this email or phone",
          409
        );
      }

      const staff = new StaffSchema(bodyData);
      const savedStaff = await staff.save();

      const userPayload = {
        firstname: bodyData.firstname,
        lastname: bodyData.lastname,
        email: bodyData.email,
        phone: bodyData.phone,
        countryCode: bodyData.countryCode,
        role: UserTypes.STAFF,
        staff_id: savedStaff._id, // link staff to user
        addedByAdmin: true, // mark that admin created it
        dob: bodyData.dob,
        gender: bodyData.gender,
        address: bodyData.address,
        city: bodyData.city,
        state: bodyData.state,
        country: bodyData.country,
        isPasswordChanged: true
      };

      const user = await createUser(userPayload, res);
      console.log("user", user)

      logger.info(
        "Doctor added successfully",
        { staffId: savedStaff._id, userId: user._id }
      );

    
      return responseData.success(
        res,
        { staff: savedStaff, user }, // return both if you want
        messageConstants.DATA_SAVED_SUCCESSFULLY
      );
    } catch (error) {
      console.error(error);
      logger.error("Add Doctor " + messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(
        res,
        messageConstants.INTERNAL_SERVER_ERROR,
        500
      );
    }
  });
};


const getDoctor = async (req, userDetails, res) => {
  return new Promise(async () => {
    try {
      const skip = parseInt(req.query.skip) || 0;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || "";

      let match;
      if (search) {
        match = {
          $and: [
            { is_deleted: false },
            {
              $or: [
                { firstname: { $regex: search, $options: "i" } },
                { lastname: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                {
                  $expr: {
                    $regexMatch: {
                      input: { $toString: "$phone" },
                      regex: search,
                      options: "i"
                    }
                  }
                },
                { phone: { $regex: search, $options: "i" } }
              ]
            }
          ]
        };
      } else {
        match = { is_deleted: false };
      }

      const result = await StaffSchema.aggregate([
        { $match: match },   // ✅ use constructed match
        {
          $facet: {
            data: [
              {
                $sort: { created_at: -1 },
              },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  // top-level fields
                  firstname: 1,
                  lastname: 1,
                  email: 1,
                  countryCode: 1,
                  phone: 1,
                  dob: 1,
                  gender: 1,
                  address: 1,
                  city: 1,
                  state: 1,
                  country: 1,
                  pincode: 1,
                  qualification: 1,
                  specialization: 1,
                  occupation: 1,
                  professionalStatus: 1,
                  created_at: 1,
                  updated_at: 1,
                  is_deleted: 1,
                  status: 1,

                  // flatten workExperience
                  workExperience_totalYears: "$workExperience.totalYears",
                  workExperience_lastHospital: "$workExperience.lastHospital",
                  workExperience_position: "$workExperience.position",
                  workExperience_workAddress_hospitalName: "$workExperience.workAddress.hospitalName",
                  workExperience_workAddress_line1: "$workExperience.workAddress.line1",
                  workExperience_workAddress_city: "$workExperience.workAddress.city",
                  workExperience_workAddress_state: "$workExperience.workAddress.state",
                  workExperience_workAddress_country: "$workExperience.workAddress.country",
                  workExperience_workAddress_pincode: "$workExperience.workAddress.pincode",

                  // flatten familyDetails
                  familyDetails_father_name: "$familyDetails.father.name",
                  familyDetails_father_contact: "$familyDetails.father.contact",
                  familyDetails_father_occupation: "$familyDetails.father.occupation",

                  familyDetails_mother_name: "$familyDetails.mother.name",
                  familyDetails_mother_contact: "$familyDetails.mother.contact",
                  familyDetails_mother_occupation: "$familyDetails.mother.occupation",

                  familyDetails_permanentAddress_line1: "$familyDetails.permanentAddress.line1",
                  familyDetails_permanentAddress_line2: "$familyDetails.permanentAddress.line2",
                  familyDetails_permanentAddress_city: "$familyDetails.permanentAddress.city",
                  familyDetails_permanentAddress_state: "$familyDetails.permanentAddress.state",
                  familyDetails_permanentAddress_country: "$familyDetails.permanentAddress.country",
                  familyDetails_permanentAddress_pincode: "$familyDetails.permanentAddress.pincode",

                  familyDetails_currentAddress_line1: "$familyDetails.currentAddress.line1",
                  familyDetails_currentAddress_line2: "$familyDetails.currentAddress.line2",
                  familyDetails_currentAddress_city: "$familyDetails.currentAddress.city",
                  familyDetails_currentAddress_state: "$familyDetails.currentAddress.state",
                  familyDetails_currentAddress_country: "$familyDetails.currentAddress.country",
                  familyDetails_currentAddress_pincode: "$familyDetails.currentAddress.pincode",

                  familyDetails_sameAsPermanent: "$familyDetails.sameAsPermanent",

                  familyDetails_emergencyContact_name: "$familyDetails.emergencyContact.name",
                  familyDetails_emergencyContact_relation: "$familyDetails.emergencyContact.relation",
                  familyDetails_emergencyContact_contact: "$familyDetails.emergencyContact.contact",
                },
              },

            ],
            totalCount: [
              { $count: "count" }
            ],
          }
        }
      ],

      );
      const doctors = result[0].data;
      const totalCount = result[0].totalCount[0]?.count || 0;
      if (doctors.length > 0) {
        return responseData.success(
          res,
          {
            rows: doctors,
            total_count: totalCount
          },
          `Doctor ${messageConstants.LIST_FETCHED_SUCCESSFULLY}`
        );
      } else {
        return responseData.fail(
          res,
          {
            rows: [],
            total_count: 0
          },
          `Doctor ${messageConstants.LIST_NOT_FOUND}`,
          204
        );
      }

    } catch (error) {
      logger.error("Get Doctor " + messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};


const getDoctorById = async (req, res) => {
  return new Promise(async () => {
    try {
      const id = req?.params?._id; // doctor id from query params
      if (!id) {
        return responseData.fail(res, "Doctor ID is required", 400);
      }
      const doctor = await StaffSchema.findById(id).lean(); // .lean() gives plain JS object

      if (doctor) {
        return responseData.success(
          res,
          doctor,
          `Doctor ${messageConstants.FETCHED_SUCCESSFULLY}`
        );
      } else {
        return responseData.fail(
          res,
          `Doctor ${messageConstants.NOT_FOUND}`,
          404
        );
      }
    } catch (error) {
      console.log(error, "Error")
      logger.error("get Doctor " + messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  })
}


const editDoctor = async (req, userDetails, res) => {
  return new Promise(async () => {
    try {
      const doctorId = req.params._id;
      const bodyData = req.body;

      const updatedDoctor = await StaffSchema.findByIdAndUpdate(
        doctorId,
        { ...bodyData, updated_at: Date.now() },
        { new: true }
      );

      if (!updatedDoctor) {
        return responseData.fail(
          res,
          `Doctor ${messageConstants.NOT_FOUND}`,
          404
        );
      }
      const userPayload = {
        firstname: bodyData.firstname,
        lastname: bodyData.lastname,
        email: bodyData.email,
        phone: bodyData.phone,
        countryCode: bodyData.countryCode,
        role: UserTypes.STAFF,
        dob: bodyData.dob,
        gender: bodyData.gender,
        address: bodyData.address,
        city: bodyData.city,
        state: bodyData.state,
        country: bodyData.country,
      };
      logger.info(`Doctor updated successfully: ${doctorId}`);
      const user = await UserSchema?.findOne({ staff_id: doctorId });
      await editUser(userPayload, user?._id, res)
      return responseData.success(
        res,
        updatedDoctor,
        messageConstants.UPDATE_SUCCESS
      );
    } catch (error) {
      logger.error("Edit Doctor " + messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};


const deleteDoctor = async (req, userDetails, res) => {
  return new Promise(async () => {
    try {
      const doctorId = req.params._id;

      const deletedDoctor = await StaffSchema.findByIdAndUpdate(
        doctorId,
        { is_deleted: true, updated_at: Date.now() },
        { new: true }
      );

      if (!deletedDoctor) {
        return responseData.fail(
          res,
          `Doctor ${messageConstants.NOT_FOUND}`,
          404
        );
      }

      logger.info(`Doctor deleted successfully: ${doctorId}`);
      return responseData.success(
        res,
        deletedDoctor,
        messageConstants.DELETE_SUCCESS
      );
    } catch (error) {
      logger.error("Delete Doctor " + messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};

module.exports = {
  addDoctor,
  getDoctor,
  editDoctor,
  deleteDoctor,
  getDoctorById
};