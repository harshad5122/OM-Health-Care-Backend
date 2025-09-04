const StaffSchema = require('../../models/staff');
const { responseData, messageConstants } = require('../../constants');
const { logger } = require('../../utils');
const { UserTypes } = require('../../constants/enum');
const { createUser } = require('../../services/user')



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
        staffId: savedStaff._id, // link staff to user
        addedByAdmin: true, // mark that admin created it
        dob: bodyData.dob,
        gender: bodyData.gender,
        address: bodyData.address,
        city: bodyData.city,
        state: bodyData.state,
        country: bodyData.country
      };

      const user = await createUser(userPayload, res);

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
      const doctors = await StaffSchema.find({
        role: UserTypes.STAFF,
        is_deleted: false,
      })
        .select("-__v -token")
        .sort({ created_at: -1 });

      if (doctors.length > 0) {
        return responseData.success(
          res,
          doctors,
          `Doctor ${messageConstants.LIST_FETCHED_SUCCESSFULLY}`
        );
      } else {
        return responseData.fail(
          res,
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


const editDoctor = async (req, userDetails, res) => {
  return new Promise(async () => {
    try {
      const doctorId = req.params._id;
      const updateData = req.body;

      const updatedDoctor = await StaffSchema.findByIdAndUpdate(
        doctorId,
        { ...updateData, updated_at: Date.now() },
        { new: true }
      );

      if (!updatedDoctor) {
        return responseData.fail(
          res,
          `Doctor ${messageConstants.NOT_FOUND}`,
          404
        );
      }

      logger.info(`Doctor updated successfully: ${doctorId}`);
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
};