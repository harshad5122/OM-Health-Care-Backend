// services/user/index.js

const UserSchema = require('../../models/user');
const { responseData, messageConstants } = require('../../constants');
const { logger } = require('../../utils');
const { UserTypes } = require('../../constants/enum');

const getAdminList = async (req, user, res) => {
    return new Promise(async () => {
        try {
            const result = await UserSchema.find({
                role: UserTypes.ADMIN,
                is_deleted: false
            })
            .select('-password -token')   // exclude sensitive fields
            .sort({ created_at: -1 });

            if (result.length > 0) {
                return responseData.success(
                    res,
                    result,
                    `Admin ${messageConstants.LIST_FETCHED_SUCCESSFULLY}`
                );
            } else {
                return responseData.fail(
                    res,
                    `Admin ${messageConstants.LIST_NOT_FOUND}`,
                    204
                );
            }
        } catch (error) {
            logger.error("Get Admin List " + messageConstants.INTERNAL_SERVER_ERROR, error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};

const getStaffList = async (req, user, res) => {
    return new Promise(async () => {
        try {
            const result = await UserSchema.find({
                role: UserTypes.STAFF,
                is_deleted: false
            })
            .select('-password -token')
            .sort({ created_at: -1 });

            if (result.length > 0) {
                return responseData.success(
                    res,
                    result,
                    `Staff ${messageConstants.LIST_FETCHED_SUCCESSFULLY}`
                );
            } else {
                return responseData.fail(
                    res,
                    `Staff ${messageConstants.LIST_NOT_FOUND}`,
                    204
                );
            }
        } catch (error) {
            logger.error("Get Staff List " + messageConstants.INTERNAL_SERVER_ERROR, error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};

const getUserList = async (req, user, res) => {
    return new Promise(async () => {
        try {
            const result = await UserSchema.find({
                role: UserTypes.USER,
                is_deleted: false
            })
            .select('-password -token')
            .sort({ created_at: -1 });

            if (result.length > 0) {
                return responseData.success(
                    res,
                    result,
                    `User ${messageConstants.LIST_FETCHED_SUCCESSFULLY}`
                );
            } else {
                return responseData.fail(
                    res,
                    `User ${messageConstants.LIST_NOT_FOUND}`,
                    204
                );
            }
        } catch (error) {
            logger.error("Get User List " + messageConstants.INTERNAL_SERVER_ERROR, error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};

const getUserProfile = async (req, userDetails, res) => {
    return new Promise(async () => {
        try {
            const userId = userDetails?._id;
            if (!userId) {
                logger.error("User ID not found in token");
                return responseData.fail(res, messageConstants.USER_NOT_FOUND, 404);
            }

            const user = await UserSchema.findById(userId).select("-password -__v -token -is_deleted");
            if (!user) {
                logger.error(`User not found with id: ${userId}`);
                return responseData.fail(res, messageConstants.USER_NOT_FOUND, 404);
            }

            logger.info(`Fetched profile for userId: ${userId}`);
            return responseData.success(res, user, messageConstants.FETCH_SUCCESS);
        } catch (error) {
            logger.error("Error in getUserProfile", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};


const updateUserProfile = async (req, userDetails, res) => {
    return new Promise(async () => {
        try {
            const userId = userDetails?._id;
            if (!userId) {
                logger.error("User ID not found in token");
                return responseData.fail(res, messageConstants.USER_NOT_FOUND, 404);
            }

            const updateData = { ...req.body, updated_at: new Date() };

            // prevent changing role, password directly from here
            delete updateData.password;
            delete updateData.role;
            delete updateData.is_deleted;
            delete updateData.token;

            const updatedUser = await UserSchema.findByIdAndUpdate(
                userId,
                { $set: updateData },
                { new: true, runValidators: true }
            ).select("-password -__v -token -is_deleted");

            if (!updatedUser) {
                logger.error(`User not found with id: ${userId}`);
                return responseData.fail(res, messageConstants.USER_NOT_FOUND, 404);
            }

            logger.info(`Updated profile for userId: ${userId}`);
            return responseData.success(res, updatedUser, messageConstants.UPDATE_SUCCESS);
        } catch (error) {
            logger.error("Error in updateUserProfile", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};

module.exports = {
    getAdminList,
    getStaffList,
    getUserList,
    getUserProfile,
    updateUserProfile

};
