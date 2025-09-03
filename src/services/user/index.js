// services/user/index.js

const UserSchema = require('../../models/user');
const { responseData, messageConstants } = require('../../constants');
const { logger } = require('../../utils');
const { UserTypes } = require('../../constants/enum');
const { cryptoGraphy } = require('../../middlewares');

// services/userService.js

const createUser = async (userData, res) => {
    return new Promise(async () => {
        try {
            // Check if user already exists by email or phone
            const existingUser = await UserSchema.findOne({
                $or: [{ email: userData.email }, { phone: userData.phone }],
            });

            if (existingUser) {
                logger.error(`user already exists`);
                return responseData.fail(res, `user already exists `, 403);
            }

            // If password not provided → assign default and mark flag
            if (!userData.password) {
                userData.password = process.env.DEFAULT_USER_PASSWORD || "Temp@123";
                userData.addedByAdmin = userData?.addedByAdmin
            } else {
                userData.addedByAdmin = false
            }
            if (!userData?.role) {
                userData.role = UserTypes.USER
            }
            console.log(userData.email, " ", userData.password, "email password")
            // Hash password
            userData.password = await cryptoGraphy.hashPassword(userData.password);



            const user = new UserSchema(userData);
            const savedUser = await user.save();

            const userObj = savedUser.toObject();
            delete userObj.password;

            return responseData.success(res, userObj, messageConstants.USER_CREATED);
        } catch (error) {

            logger.error("Create user " + messageConstants.INTERNAL_SERVER_ERROR, error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 400);
        }
    });
};




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

const editUser = async (req, userDetails, res) => {
    return new Promise(async () => {
        try {
            // const userId = userDetails?._id;
            const userId = req.params._id;

            if (!userId) {
                logger.error("User ID not found in token");
                return responseData.fail(res, messageConstants.USER_NOT_FOUND, 404);
            }

            const updateData = req.body;
            updateData.updated_at = new Date(); // keep updated timestamp

            const updatedUser = await UserSchema.findByIdAndUpdate(
                userId,
                { $set: updateData },
                { new: true, runValidators: true, select: "-password -__v -token -is_deleted" }
            );

            if (!updatedUser) {
                logger.error(`Failed to update user with id: ${userId}`);
                return responseData.fail(res, messageConstants.UPDATE_FAILED, 400);
            }

            logger.info(`Updated user profile successfully for userId: ${userId}`);
            return responseData.success(res, updatedUser, messageConstants.UPDATE_SUCCESS);
        } catch (error) {
            logger.error("Error in editUser", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};

const deleteUser = async (req, userDetails, res) => {
    return new Promise(async () => {
        try {
            // const userId = userDetails?._id;
            const userId = req.params._id;
            if (!userId) {
                logger.error("User ID not found in token");
                return responseData.fail(res, messageConstants.USER_NOT_FOUND, 404);
            }

            const deletedUser = await UserSchema.findByIdAndUpdate(
                userId,
                { $set: { is_deleted: true, updated_at: new Date() } },
                { new: true }
            );

            if (!deletedUser) {
                logger.error(`Failed to delete user with id: ${userId}`);
                return responseData.fail(res, messageConstants.DELETE_FAILED, 400);
            }

            logger.info(`User soft deleted successfully with id: ${userId}`);
            return responseData.success(res, {}, messageConstants.DELETE_SUCCESS);
        } catch (error) {
            logger.error("Error in deleteUser", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};


module.exports = {
    getAdminList,
    getStaffList,
    getUserList,
    getUserProfile,
    updateUserProfile,
    editUser,
    deleteUser,
    createUser,

};
