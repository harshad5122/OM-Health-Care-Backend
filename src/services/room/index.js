const RoomSchema = require('../../models/room');
const UserSchema = require('../../models/user')
const { responseData, messageConstants } = require('../../constants');
const { logger } = require('../../utils');
const mongoose = require("mongoose");
const { UserTypes } = require('../../constants');

const createRoom = async (body, userDetails, res) => {

    return new Promise(async () => {
        try {
            const userId = userDetails._id; 

            // const membersEmails = body.members || [];

             if (![UserTypes.ADMIN, UserTypes.STAFF].includes(userDetails.role)) {
                return responseData.fail(res, "Only Admin or Staff can create groups", 403);
            }
            const membersPhones  = body.members || [];
            const users = await UserSchema.find({
                phone: { $in: membersPhones }
            }).select('_id phone');

            if (users.length !== membersPhones.length) {
                const foundEmails = users.map(u => u.email);
                const missing = membersPhones.filter(email => !foundEmails.includes(email));
                return responseData.fail(res, `Invalid emails: ${missing.join(', ')}`, 400);
            }

            const memberIds = users.map(u => u._id.toString());

              // Ensure the creator (userId) is added as a member
           if (!memberIds.includes(userId.toString())) {
            memberIds.push(userId);
           }

            const room  = new RoomSchema({
                ...body,
               user_id: userId,
                members: memberIds,
               // members: body.members || []
               admin: userId
            });

            await room.save().then( async (result) => {
                logger.info(messageConstants.ROOM_CREATE_SUCCESS);
                return responseData.success(res, result, messageConstants.ROOM_CREATE_SUCCESS);
            });
            
        } catch (error) {
           logger.error(messageConstants.MESSAGE_FETCH_FAILED, error);
            return responseData.fail(res, messageConstants.MESSAGE_FETCH_FAILED, 500);
        }
    });
}

const updateRoom = async (req, userDetails, res) => {
    return new Promise(async () => {
        try{
            const { id: roomId } = req.params;
            const {addMembers = [], removeMembers = [], ...updateData} = req.body;
            const userId = userDetails._id; 
            
            if (!roomId){
                return responseData.fail(res, messageConstants.ROOM_ID_REQUIRED, 400);
            }

            const existingRoom = await RoomSchema.findOne({_id: roomId, user_id: userId});
            if (!existingRoom){
                logger.warn(messageConstants.ROOM_NOT_FOUND);
                return responseData.fail(res, messageConstants.ROOM_NOT_FOUND, 404);
            }

             // Convert addMembers emails to user IDs
             let newMemberIds = [];
             if (addMembers.length > 0) {
                 const users = await UserSchema.find({ email: { $in: addMembers } }).select('_id email');
                 const foundEmails = users.map(u => u.email);
                 const missing = addMembers.filter(email => !foundEmails.includes(email));
                 if (missing.length > 0) {
                     return responseData.fail(res, `Invalid emails: ${missing.join(', ')}`, 400);
                 }
                 const existingMemberIds = existingRoom.members.map(m => m.toString());
                const alreadyInGroupEmails = users
                    .filter(user => existingMemberIds.includes(user._id.toString()))
                    .map(user => user.email);

                if (alreadyInGroupEmails.length > 0) {
                    return responseData.fail(res, `User already in the group: ${alreadyInGroupEmails.join(', ')}`, 400);
                }
                 newMemberIds = users.map(u => u._id.toString());
             }
             

            let updatedMembers = new Set(existingRoom.members.map(member => member.toString()));
           // addMembers.forEach(memberId => updatedMembers.add(memberId));
           newMemberIds.forEach(memberId => updatedMembers.add(memberId));
            removeMembers.forEach(memberId => updatedMembers.delete(memberId));
            updateData.members = Array.from(updatedMembers);

            const updatedRoom = await RoomSchema.findOneAndUpdate(
                { _id: roomId, user_id: userId},
                { $set: {
                    ...updateData,
                }
                },
                { new: true, runValidators: true}
            );

            if(!updatedRoom) {
                logger.warn(messageConstants.ROOM_NOT_FOUND);
                return responseData.fail(res, messageConstants.ROOM_NOT_FOUND, 404);
            }

            logger.info(messageConstants.ROOM_UPDATE_SUCCESS);
            return responseData.success(res, updatedRoom, messageConstants.ROOM_UPDATE_SUCCESS);

        }catch(error){
            logger.error(`Error updating room: ${error.message}`);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
}

const createAdmin = async (req, userDetails, res) => {
    return new Promise(async () => {
        try {
            const { room_id, admin_member } = req.body;
            const userId = userDetails._id;

            if (!mongoose.Types.ObjectId.isValid(room_id)) {
                return responseData.fail(res, messageConstants.INVALID_ROOM_ID, 400);
            }

            const room = await RoomSchema.findById(room_id);

            if (!room) {
                return responseData.fail(res, messageConstants.ROOM_NOT_FOUND, 404);
            }

        //Only allow current admins to add new admins
        const isAuthorized = room.admin.some(adminId =>
            adminId.toString() === userId.toString()
        );
        if (!isAuthorized) {
            return responseData.fail(res, messageConstants.UNAUTHORIZED_ADMIN, 403);
        }

            const adminUser = await UserSchema.findById(admin_member);
            if (!adminUser) {
                return responseData.fail(res, messageConstants.ADMIN_USER_NOT_FOUND, 404);
            }

             // Check if admin is part of room members
            const isMember = room.members.some(memberId =>
               memberId.toString() === adminUser._id.toString()
            );
            if (!isMember) {
                return responseData.fail(res, messageConstants.ADMIN_NOT_MEMBER, 400);
            }

             //  Prevent duplicate admins
             const alreadyAdmin = room.admin.some(adminId =>
                adminId.toString() === adminUser._id.toString()
            );
            if (alreadyAdmin) {
                return responseData.fail(res, messageConstants.ALREADY_ADMIN, 400);
            }

             //  Add new admin
             room.admin.push(adminUser._id);
             await room.save();

            return responseData.success(res, { admin_name: adminUser.firstname },messageConstants.GROUP_ADMIN_SET);

        } catch (error) {
            logger.error(`Error create admin: ${error.message}`);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
}

const removeAdmin = async (req, userDetails, res) => {
    return new Promise(async () => {
        try {
            const { room_id, admin_member } = req.body;
            const userId = userDetails._id;

            if (!mongoose.Types.ObjectId.isValid(room_id)) {
                return responseData.fail(res, messageConstants.INVALID_ROOM_ID, 400);
            }

            const room = await RoomSchema.findById(room_id);
            if (!room) {
                return responseData.fail(res, messageConstants.ROOM_NOT_FOUND, 404);
            }

            // Only current admins can remove other admins
            const isAuthorized = room.admin.some(adminId =>
                adminId.toString() === userId.toString()
            );
            if (!isAuthorized) {
                return responseData.fail(res, messageConstants.UNAUTHORIZED_ADMIN, 403);
            }

            // Cannot remove yourself (optional)
            if (userId.toString() === admin_member.toString()) {
                return responseData.fail(res, messageConstants.CANNOT_REMOVE_SELF_ADMIN, 400);
            }

            // Check if the user to be removed is actually an admin
            const isAdmin = room.admin.some(adminId =>
                adminId.toString() === admin_member.toString()
            );
            if (!isAdmin) {
                return responseData.fail(res, messageConstants.USER_NOT_ADMIN, 400);
            }

            // Remove the admin
            room.admin = room.admin.filter(adminId =>
                adminId.toString() !== admin_member.toString()
            );

            await room.save();

            return responseData.success(res, {}, messageConstants.ADMIN_REMOVED);

        } catch (error) {
            logger.error(`Error remove admin: ${error.message}`);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};

const getRoomMembers = async (req, userDetails, res) => {
    return new Promise(async () => {
        try {
            const { roomId  } = req.params; 
            const userId = userDetails._id;

            if (!mongoose.Types.ObjectId.isValid(roomId)) {
                return responseData.fail(res, messageConstants.INVALID_ROOM_ID, 400);
            }

            const room = await RoomSchema.findById(roomId)
            .populate({
                path: 'members',
                select: 'firstname lastname email',
            })
            .populate({
                path: 'admin',
                select: '_id',
            })
            .lean(); // convert to plain JS object for modification

        if (!room) {
            return responseData.fail(res, messageConstants.ROOM_NOT_FOUND, 404);
        }

        room.admin = room.admin || [];
         room.members = room.members || [];

        // Map members and mark if they are admin
        const membersWithRoles = room.members.map(member => {
            //const isAdmin = room.admin.some(adminId => adminId._id.toString() === member._id.toString());
            const isAdmin = Array.isArray(room.admin) && room.admin.some(adminId => adminId._id.toString() === member._id.toString());
            return {
                _id: member._id,
                firstname: member.firstname,
                lastname: member.lastname,
                email: member.email,
                is_admin: isAdmin,
            };
        });

        return responseData.success(res, {
            room_name: room.name,
            total_members: membersWithRoles.length,
            members: membersWithRoles,
            current_user_id: userId
        }, "Room members fetched successfully");


        } catch (error) {
            logger.error(`Error get room members: ${error.message}`);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    });
};


module.exports = {
    createRoom,
    updateRoom,
    createAdmin,
    removeAdmin,
    getRoomMembers
}