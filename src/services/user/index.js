// services/user/index.js

const UserSchema = require('../../models/user');
const { responseData, messageConstants, mailTemplateConstants, mailSubjectConstants } = require('../../constants');
const { logger, mail } = require('../../utils');
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
                userData.password = process.env.DEFAULT_USER_PASSWORD || "OmHealth@123";
                userData.isPasswordChanged = userData?.isPasswordChanged
                userData.addedByAdmin = userData?.addedByAdmin
            } else {
                userData.isPasswordChanged = false
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
            // if (isFunctionCall){
            console.log('userObj', userObj);
            const mailContent = {
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                password: process.env.DEFAULT_USER_PASSWORD,
            };
            // return savedUser.toObject();
            await mail.sendMailToUser(
                mailTemplateConstants.ADD_DOCTOR_TEMPLATE,
                user.email,
                mailSubjectConstants.ADD_DOCTOR_SUBJECT,
                mailContent
            );

            // } 
            delete userObj.password;
            return responseData.success(res, userObj, messageConstants.USER_CREATED);

        } catch (error) {
            console.log(error);
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
            const skip = req.query.skip && !isNaN(req.query.skip) ? parseInt(req.query.skip) : null;
            const limit = req.query.limit && !isNaN(req.query.limit) ? parseInt(req.query.limit) : null;
            const from_date = req.query.from_date ? new Date(req.query.from_date) : null;
            const to_date = req.query.to_date ? new Date(req.query.to_date) : null;
            let match = { role: UserTypes.USER, is_deleted: false };
            const search = req.query.search || "";

            if (search) {
                match = {
                    $and: [
                        { role: UserTypes.USER, is_deleted: false },
                        {
                            $or: [
                                { firstname: { $regex: search, $options: "i" } },
                                { lastname: { $regex: search, $options: "i" } },
                                { email: { $regex: search, $options: "i" } },
                                {
                                    $expr: {
                                        $regexMatch: {
                                            input: { $toString: "$phone" }, // ✅ safe for number/string
                                            regex: search,
                                            options: "i",
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                };
            }
            const isValidDate = (d) => d instanceof Date && !isNaN(d);
            if (isValidDate(from_date) || isValidDate(to_date)) {
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
            let query = UserSchema.find(match).select("-password -token").sort({ created_at: -1 });
            if (skip !== null && limit !== null) {
                query = query.skip(skip).limit(limit);
            }
            const result = await query;
            const total_count = await UserSchema.countDocuments(match);

            if (result.length > 0) {

                return responseData.success(
                    res,
                    (skip != null && limit != null) ? { rows: result, total_count } : result,
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

const editUser = async (updateData, userId, res) => {
    return new Promise(async () => {
        try {
            // const userId = userDetails?._id;
            // const userId = req.params._id;

            if (!userId) {
                logger.error("User ID not found in token");
                return responseData.fail(res, messageConstants.USER_NOT_FOUND, 404);
            }

            // const updateData = req.body;
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
