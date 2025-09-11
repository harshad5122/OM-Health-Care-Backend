const StaffSchema = require('../../models/staff');
const UserSchema = require('../../models/user');
const { responseData, messageConstants } = require('../../constants');
const { logger } = require('../../utils');
const { UserTypes, defaultWeeklySchedule } = require('../../constants/enum');
const { createUser, editUser } = require('../../services/user');
const WeeklyScheduleSchema = require('../../models/weekly_schedule_pattern');



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



      const schedule = await WeeklyScheduleSchema.create({
        staff_id: savedStaff._id,
        weekly_schedule: defaultWeeklySchedule
      });
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
      const from_date = req.query.from_date ? new Date(req.query.from_date) : null;
      const to_date = req.query.to_date ? new Date(req.query.to_date) : null;
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

      if (from_date || to_date) {
        const dateFilter = {};
        if (from_date) dateFilter.$gte = from_date;
        if (to_date) dateFilter.$lte = to_date;

        // Apply date filter
        if (match.$and) {
          match.$and.push({ created_at: dateFilter });
        } else {
          match.created_at = dateFilter;
        }
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
                  phone: { $concat: ["$countryCode", " ", "$phone"] },
                  dob: {
                    $cond: {
                      if: { $ifNull: ["$dob", false] },
                      then: { $dateToString: { format: "%m/%d/%Y", date: "$dob" } },
                      else: null
                    }
                  },
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
                  workExperience_totalYears: "$workExperience.totalYears",
                  workExperience_lastHospital: "$workExperience.lastHospital",
                  workExperience_position: "$workExperience.position",
                  father_name: "$familyDetails.father.name",
                  mother_name: "$familyDetails.mother.name",
                  emergencyContact_name: "$familyDetails.emergencyContact.name",
                  emergencyContact_relation: "$familyDetails.emergencyContact.relation",
                  emergencyContact_contact: "$familyDetails.emergencyContact.contact",
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
        return responseData.success(
          res,
          {
            rows: [],
            total_count: 0
          },
          `Doctor ${messageConstants.LIST_FETCHED_SUCCESSFULLY}`
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