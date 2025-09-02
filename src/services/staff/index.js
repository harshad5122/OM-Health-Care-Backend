const StaffSchema = require('../../models/staff');
const { responseData, messageConstants } = require('../../constants');
const { logger } = require('../../utils');
const { UserTypes } = require('../../constants/enum');


const addDoctor = async (req, userDetails, res) => {
  return new Promise(async () => {
    try {
      const bodyData = req.body;

      // Ensure staff role is assigned
      bodyData.role = UserTypes.STAFF;

      const staff = new StaffSchema(bodyData);
      const savedStaff = await staff.save();

      logger.info("Doctor added successfully", savedStaff._id);

      return responseData.success(
        res,
        savedStaff,
        messageConstants.DATA_SAVED_SUCCESSFULLY
      );
    } catch (error) {
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