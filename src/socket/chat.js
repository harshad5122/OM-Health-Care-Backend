const SocketSchema = require('../models/socket');
const MessageSchema = require('../models/message');
const GroupMessageSchema = require('../models/group_message');
const RoomSchema = require('../models/room');  
const User = require('../models/user');
const NotificationSchema = require('../models/notification');
const { logger, mail } = require("../utils");
const { messageConstants, mailTemplateConstants, mailSubjectConstants } = require('../constants');
const { NotificationType, MessageStatus } = require('../constants/enum');
const mongoose = require("mongoose");
const emailTimers = new Map();


const onlineUsers = new Map();  // Track online users by user_id
const userTimeouts = new Map(); // Track timeouts for each user

module.exports = (io) => {    
    logger.info(`Socket ${messageConstants.CONNECTED_SUCCESSFULLY}`);
    io.on('connection', async (socket) => {
        logger.info(`User ${socket.id} ${messageConstants.CONNECTED_SUCCESSFULLY}`);

        //notificationHandler(io, socket);

        socket.on('connect_user', async (data) => {
            logger.info(`Data received in request body during connect_user ${JSON.stringify(data)}`)
            socket.join(data.user_id); 
            const socketData = await SocketSchema.find({ user_id: data.user_id });
            if (socketData.length !== 0) {
                await updateSocket(socket, socketData);
            } else {
                await createSocket(data, socket);
            }
            await socket.emit('connect_user', socket.id);
        });

        socket.on('user_online', async (userId) => {
            logger.info(`User ${userId} entered message page`);

            // Mark user as online
            onlineUsers.set(userId, socket.id);

            // Clear any previous timeout if exists
            if (userTimeouts.has(userId)) {
                clearTimeout(userTimeouts.get(userId));
                userTimeouts.delete(userId);
            }

            
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { is_online: true, last_seen: new Date() },
                { new: true }
            );
            logger.info(`User is_online: ${updatedUser.is_online}`);
        

            // Emit to all clients that this user is online
            io.emit('presence_update', { userId, isOnline: true });

            // Set timeout to mark user as offline after 2 minutes of inactivity
            const timeout = setTimeout(async () => {
                onlineUsers.delete(userId);
                userTimeouts.delete(userId);

                const offlineUser = await User.findByIdAndUpdate(
                    userId,
                    { is_online: false, last_seen: new Date() },
                    { new: true }
                );
                logger.info(`User is_online: ${offlineUser.is_online} (timed out)`);

                io.emit('presence_update', { userId, isOnline: false });
                logger.info(`User ${userId} marked offline after 2 minutes of inactivity`);
            }, 2 * 60 * 1000); // 2 minutes
            userTimeouts.set(userId, timeout);
        });

        socket.on('user_left_message_page', async (userId) => {
            logger.info(`User ${userId} left message page`);

            if (userTimeouts.has(userId)) {
                clearTimeout(userTimeouts.get(userId));
                userTimeouts.delete(userId);
            }

            // Start 2-minute timer before setting user offline
            const timeout = setTimeout(async () => {
                onlineUsers.delete(userId);
                userTimeouts.delete(userId);

                const offlineUser = await User.findByIdAndUpdate(
                    userId,
                    { is_online: false, last_seen: new Date() },
                    { new: true }
                );
                logger.info(`User is_online: ${offlineUser.is_online} (left page)`);
        

                io.emit('presence_update', { userId, isOnline: false });
                logger.info(`User ${userId} marked offline after 2 minutes of inactivity`);
            }, 2 * 60 * 1000); 

            userTimeouts.set(userId, timeout);
        });

        socket.on('disconnect', () => {
            logger.info("Socket disconnected:", socket.id);

            // Handle disconnection (user goes offline immediately)
            for (let [userId, sId] of onlineUsers.entries()) {
                if (sId === socket.id) {
                    onlineUsers.delete(userId);
                    if (userTimeouts.has(userId)) {
                        clearTimeout(userTimeouts.get(userId));
                        userTimeouts.delete(userId);
                    }

                    User.findByIdAndUpdate(userId, {
                        is_online: false,
                        last_seen: new Date(),
                    },
                    { new: true }
                ).then(() => {
                    logger.info(`User ${userId} is_online: ${disconnectedUser.is_online} (disconnected)`);
                io.emit('presence_update', { userId, isOnline: false });
            }).catch(console.log);
                    break;
                }
            }
        });

        // Join a group chat
        socket.on('join_room', async (data) => {
            logger.info(`User joining room: ${JSON.stringify(data)}`);
            const { user_id, room_id } = data;

            // Check if room exists
            const room = await RoomSchema.findById(room_id);
            if (!room) {
                logger.error(`Room ID ${room_id} not found`);
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            socket.join(room_id); // Join socket.io room
            logger.info(`User ${user_id} joined room ${room_id}`);

            socket.emit('joined_room', { message: `Joined room ${room_id}` });
        });

        // Leave a group chat
        socket.on('leave_room', async (data) => {
            logger.info(`User leaving room: ${JSON.stringify(data)}`);
            const { user_id, room_id } = data;
        
            try {
                // Remove user from room in DB
                await RoomSchema.findByIdAndUpdate(
                    room_id,
                    { $pull: { members: user_id, admin: user_id } }, // assuming 'members' is an array of user IDs
                    { new: true }
                );
        
                socket.leave(room_id);
        
                logger.info(`User ${user_id} left room ${room_id} and was removed from DB`);
                socket.emit('left_room', { message: `Left room ${room_id}` });

                // Optional: Broadcast to other users in room
                socket.to(room_id).emit('user_left_room', { user_id });
        
            } catch (error) {
                logger.error(`Error removing user from room: ${error}`);
                socket.emit('error', { message: 'Failed to leave room.' });
            }
        });
        
        // Create a message (direct or group)
        // socket.on('chat_message', async (data) => {
        //     if (data.replyTo) {
        //         const repliedMessage = await MessageSchema.findById(data.reply_to);
        //         if (!repliedMessage) {
        //             logger.error(`ReplyTo message ID ${data.replyTo} not found`);
        //             return;
        //         }
        //     }
        
        //     let saveMessage, populatedMessage;
        //     if (data.room_id) {
               
        //         const room = await RoomSchema.findById(data.room_id);
        //         if (!room) {
        //             logger.error(`Room ID ${data.room_id} not found`);
        //             return;
        //         }

        //         const allReceivers = room.members.filter(id => id.toString() !== data.sender_id);

        //         data.receiver_id = allReceivers;
        //         saveMessage = await createGroupMessage({ ...data, receiver_id: allReceivers });
        
        //         if (!saveMessage) {
        //             logger.error(messageConstants.MESSAGE_NOT_SENT);
        //             return;
        //         }
                
        //         populatedMessage = await GroupMessageSchema.findById(saveMessage._id).populate('attechment_id');

        //         const attachmentDetails = populatedMessage && Array.isArray(populatedMessage.attechment_id)
        //         ? populatedMessage.attechment_id.map(file => ({
        //             id: file._id,
        //             fileType: file.fileType,
        //             name: file.name,
        //             size: file.size,
        //             url: file.url
        //         }))
        //         : [];

        //         io.to(data.room_id).emit('chat_message', {
        //             ...saveMessage.toObject(),
        //             attechment_details: attachmentDetails
        //         });
    
        //         io.to(data.room_id).emit('new_message', {
        //             ...saveMessage.toObject(),
        //             attechment_details: attachmentDetails
        //         });

        //         await GroupMessageSchema.findByIdAndUpdate(saveMessage._id, {
        //             message_status: 'delivered'
        //         });
                
        //         const receiversSocketData = await SocketSchema.find({ 
        //             user_id: { $in: allReceivers }
        //         });
                  
        //         for (const receiver of receiversSocketData) {
        //             io.to(receiver.user_id.toString()).emit('receiveNotification', {
        //                 type: 'group-message',
        //                 isGroup: true,
        //                 senderId: data.sender_id,
        //                 message: saveMessage.message,
        //                 senderId: data.sender_id,
        //                 createdAt: saveMessage.created_at,
        //                 message_type: saveMessage.message_type,
        //                 attechment_details: attachmentDetails,
        //                 latitude: saveMessage.latitude,
        //                 longitude: saveMessage.longitude,
        //             });
        //         }
                  
        //         const senderSocketData = await SocketSchema.findOne({ user_id: data.sender_id });
        //         if (senderSocketData) {
        //             io.to(senderSocketData.socket_id).emit('message_delivered', {
        //                 _id: saveMessage._id,
        //                 status: 'delivered'
        //             });     
        //         }

        //     } else {
        //         saveMessage = await createMessage({ ...data });
        
        //         if (!saveMessage) {
        //             logger.error(messageConstants.MESSAGE_NOT_SENT);
        //             return;
        //         }
        
        //         populatedMessage = await MessageSchema.findById(saveMessage._id).populate('attechment_id');

        //         const attachmentDetails = populatedMessage && Array.isArray(populatedMessage.attechment_id)
        //         ? populatedMessage.attechment_id.map(file => ({
        //             id: file._id,
        //             fileType: file.fileType,
        //             name: file.name,
        //             size: file.size,
        //             url: file.url
        //         }))
        //         : [];

        //         const receiverSocketData = await SocketSchema.findOne({ user_id: data.receiver_id });

        //         // CREATE NOTIFICATION in DB
        //     const notification = await NotificationSchema.create({
        //         sender_id: data.sender_id,
        //         receiver_id: data.receiver_id,
        //         type: NotificationType.MESSAGE,  // new enum type
        //         message: saveMessage.message || "New message",
        //         reference_id: saveMessage._id,
        //         reference_model: "Message",
        //     });

        //         if (receiverSocketData) {
        //             const fullMessage = {
        //                 ...saveMessage.toObject(),
        //                 attechment_details: attachmentDetails
        //             };
                
        //             io.to(receiverSocketData.socket_id).emit('chat_message', fullMessage);
        //             io.to(receiverSocketData.socket_id).emit('new_message', fullMessage);

        //             await MessageSchema.findByIdAndUpdate(saveMessage._id, {
        //                 message_status: 'delivered'
        //             });

        //             io.to(receiverSocketData.socket_id).emit('receiveNotification', {
        //             ...notification.toObject(),
        //             attechment_details: attachmentDetails,
        //         });
    
        //             // io.to(receiverSocketData.socket_id).emit('receiveNotification', {
        //             //     type: 'message',
        //             //     isGroup: false,
        //             //     message: saveMessage.message,
        //             //     senderId: data.sender_id,
        //             //     createdAt: saveMessage.created_at,
        //             //     message_type: saveMessage.message_type,
        //             //     attechment_details: attachmentDetails,
        //             //     latitude: saveMessage.latitude,
        //             //     longitude: saveMessage.longitude,
        //             // });

        //             const senderSocketData = await SocketSchema.findOne({ user_id: data.sender_id });
        //             if (senderSocketData) {
        //                 io.to(senderSocketData.socket_id).emit('message_delivered', {
        //                     _id: saveMessage._id,
        //                     status: 'delivered'
        //                 });
        //             }
        //         } else {
        //             logger.error(messageConstants.RECEIVER_NOT_FOUND);
        //         }

        //          // -----------------------------
        //     // EMAIL REMINDER LOGIC
        //     // -----------------------------
        //     setTimeout(async () => {
        //         try {
        //             // const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        //              const oneMinuteAgo = new Date(Date.now() - 60 * 1000); 

        //             const unseenMessages = await MessageSchema.find({
        //                 receiver_id: data.receiver_id,
        //                 message_status: { $ne: MessageStatus.SEEN },
        //                 createdAt: { $gte: oneMinuteAgo }
        //             });

        //             if (unseenMessages.length > 0) {
        //                 const receiverUser = await User.findById(data.receiver_id);

        //                 if (receiverUser && receiverUser.email) {
        //                     const mailContent = {
        //                         firstname: receiverUser.firstname || '',
        //                         lastname: receiverUser.lastname || '',
        //                         unseenCount: unseenMessages.length,
        //                     };

        //                     await mail.sendMailToUser(
        //                         mailTemplateConstants.UNSEEN_MESSAGE_TEMPLATE,
        //                         receiverUser.email,
        //                         mailSubjectConstants.UNSEEN_MESSAGE_ALERT,
        //                         mailContent
        //                     );

        //                     logger.info(`📧 Email sent to ${receiverUser.email} for ${unseenMessages.length} unseen messages`);
        //                 }
        //             }
        //         } catch (error) {
        //             logger.error("Error sending unseen message email", error);
        //         }
        //     // }, 60 * 60 * 1000); // 1 hour
        //     }, 60 * 1000);  // 1 minute 
        //     }
        // });

        async function scheduleEmailReminder(receiver_id) {
    // If a timer already exists, do not create a new one
    if (emailTimers.has(receiver_id)) return;

    // Find the first unseen message
    const firstUnseenMessage = await MessageSchema.findOne({
        receiver_id,
        message_status: { $ne: MessageStatus.SEEN }
    }).sort({ created_at: 1 });

    if (!firstUnseenMessage) return;

    const firstMessageTime = firstUnseenMessage.created_at;
    // const now = new Date();
    const delay = Math.max(0, firstMessageTime.getTime() + 60 * 60 * 1000 - Date.now()); // 1 hour from first message

    const timer = setTimeout(async () => {
        try {
            const unseenMessages = await MessageSchema.find({
                receiver_id,
                message_status: { $ne: MessageStatus.SEEN },
                created_at: { $gte: firstMessageTime }
            });

            if (unseenMessages.length > 0) {
                const receiverUser = await User.findById(receiver_id);
                if (receiverUser && receiverUser.email) {
                    const mailContent = {
                        firstname: receiverUser.firstname || '',
                        lastname: receiverUser.lastname || '',
                        unseenCount: unseenMessages.length,
                    };

                    await mail.sendMailToUser(
                        mailTemplateConstants.UNSEEN_MESSAGE_TEMPLATE,
                        receiverUser.email,
                        mailSubjectConstants.UNSEEN_MESSAGE_ALERT,
                        mailContent
                    );

                    logger.info(`📧 Email sent to ${receiverUser.email} for ${unseenMessages.length} unseen messages`);
                }
            }
        } catch (error) {
            logger.error("Error sending unseen message email", error);
        } finally {
            // Remove timer after execution
            emailTimers.delete(receiver_id);
        }
    }, delay);

    emailTimers.set(receiver_id, timer);
}

socket.on('chat_message', async (data) => {
    try {
        if (data.replyTo) {
            const repliedMessage = await MessageSchema.findById(data.reply_to);
            if (!repliedMessage) {
                logger.error(`ReplyTo message ID ${data.replyTo} not found`);
                return;
            }
        }

        // Save message
        let saveMessage = await createMessage({ ...data });
        if (!saveMessage) {
            logger.error(messageConstants.MESSAGE_NOT_SENT);
            return;
        }

        const populatedMessage = await MessageSchema.findById(saveMessage._id)
            .populate('attechment_id');

        const attachmentDetails =
            populatedMessage && Array.isArray(populatedMessage.attechment_id)
                ? populatedMessage.attechment_id.map(file => ({
                    id: file._id,
                    fileType: file.fileType,
                    name: file.name,
                    size: file.size,
                    url: file.url
                }))
                : [];

        const receiverSocketData = await SocketSchema.findOne({ user_id: data.receiver_id });

        // CREATE NOTIFICATION in DB
        const notification = await NotificationSchema.create({
            sender_id: data.sender_id,
            receiver_id: data.receiver_id,
            type: NotificationType.MESSAGE,
            message: saveMessage.message || "New message",
            reference_id: saveMessage._id,
            reference_model: "Message",
        });

        // Send message to receiver
        if (receiverSocketData) {
            const fullMessage = {
                ...saveMessage.toObject(),
                attechment_details: attachmentDetails
            };

            io.to(receiverSocketData.socket_id).emit('chat_message', fullMessage);
            io.to(receiverSocketData.socket_id).emit('new_message', fullMessage);

            await MessageSchema.findByIdAndUpdate(saveMessage._id, {
                message_status: 'delivered'
            });

            io.to(receiverSocketData.socket_id).emit('receiveNotification', {
                ...notification.toObject(),
                attechment_details: attachmentDetails,
            });

            const senderSocketData = await SocketSchema.findOne({ user_id: data.sender_id });
            if (senderSocketData) {
                io.to(senderSocketData.socket_id).emit('message_delivered', {
                    _id: saveMessage._id,
                    status: 'delivered'
                });
            }
        } else {
            logger.error(messageConstants.RECEIVER_NOT_FOUND);
        }

        // Schedule email reminder for this receiver
        await scheduleEmailReminder(data.receiver_id);

    } catch (error) {
        logger.error("Error handling chat_message", error);
    }
});



//         // Create a message (direct or group)
// socket.on('chat_message', async (data) => {
//     try {
//         if (data.replyTo) {
//             const repliedMessage = await MessageSchema.findById(data.reply_to);
//             if (!repliedMessage) {
//                 logger.error(`ReplyTo message ID ${data.replyTo} not found`);
//                 return;
//             }
//         }

//         let saveMessage = await createMessage({ ...data });
//         if (!saveMessage) {
//             logger.error(messageConstants.MESSAGE_NOT_SENT);
//             return;
//         }

//         const populatedMessage = await MessageSchema.findById(saveMessage._id)
//             .populate('attechment_id');

//         const attachmentDetails =
//             populatedMessage && Array.isArray(populatedMessage.attechment_id)
//                 ? populatedMessage.attechment_id.map(file => ({
//                     id: file._id,
//                     fileType: file.fileType,
//                     name: file.name,
//                     size: file.size,
//                     url: file.url
//                 }))
//                 : [];

//         const receiverSocketData = await SocketSchema.findOne({ user_id: data.receiver_id });

//         // CREATE NOTIFICATION in DB
//         const notification = await NotificationSchema.create({
//             sender_id: data.sender_id,
//             receiver_id: data.receiver_id,
//             type: NotificationType.MESSAGE,
//             message: saveMessage.message || "New message",
//             reference_id: saveMessage._id,
//             reference_model: "Message",
//         });

//         if (receiverSocketData) {
//             const fullMessage = {
//                 ...saveMessage.toObject(),
//                 attechment_details: attachmentDetails
//             };

//             io.to(receiverSocketData.socket_id).emit('chat_message', fullMessage);
//             io.to(receiverSocketData.socket_id).emit('new_message', fullMessage);

//             await MessageSchema.findByIdAndUpdate(saveMessage._id, {
//                 message_status: 'delivered'
//             });

//             io.to(receiverSocketData.socket_id).emit('receiveNotification', {
//                 ...notification.toObject(),
//                 attechment_details: attachmentDetails,
//             });

//             const senderSocketData = await SocketSchema.findOne({ user_id: data.sender_id });
//             if (senderSocketData) {
//                 io.to(senderSocketData.socket_id).emit('message_delivered', {
//                     _id: saveMessage._id,
//                     status: 'delivered'
//                 });
//             }
//         } else {
//             logger.error(messageConstants.RECEIVER_NOT_FOUND);
//         }

//         // -----------------------------
//         // EMAIL REMINDER LOGIC (send immediately for testing)
//         // -----------------------------
//         const unseenMessages = await MessageSchema.find({
//             receiver_id: data.receiver_id,
//             message_status: { $ne: MessageStatus.SEEN }
//         });

//         if (unseenMessages.length > 0) {
//             const receiverUser = await User.findById(data.receiver_id);

//             if (receiverUser && receiverUser.email) {
//                 const mailContent = {
//                     firstname: receiverUser.firstname || '',
//                     lastname: receiverUser.lastname || '',
//                     unseenCount: unseenMessages.length,
//                 };

//                 await mail.sendMailToUser(
//                     mailTemplateConstants.UNSEEN_MESSAGE_TEMPLATE,
//                     receiverUser.email,
//                     mailSubjectConstants.UNSEEN_MESSAGE_ALERT,
//                     mailContent
//                 );

//                 logger.info(`📧 Email sent to ${receiverUser.email} for ${unseenMessages.length} unseen messages`);
//             }
//         }
//     } catch (error) {
//         logger.error("Error handling chat_message", error);
//     }
// });


        socket.on('update_message', async (data) => {
            try {
                const updatedMessage = await updateMessage(data.messageId, data);
                if (!updatedMessage) {
                    socket.emit('error', { message: 'Message update failed' });
                    return;
                }
                logger.info(`Message updated successfully: ${JSON.stringify(updatedMessage)}`);

                const receiverSocketData = await SocketSchema.findOne({ user_id: updatedMessage.receiver_id });
                if (receiverSocketData) {
                    io.to(receiverSocketData.socket_id).emit('message_updated', updatedMessage);
                } else {
                    logger.error(`Receiver not found for message ${data.messageId}`);
                }
            } catch (err) {
                socket.emit('error', { message: 'Failed to update message' });
            }
        }); 
        
        socket.on('update_group_message', async (data) => {
            try {
                const updatedMessage = await updateGroupMessage(data.messageId, data);
                io.to(data.room_id).emit('group_message_updated', updatedMessage);
            } catch (err) {
                socket.emit('error', { message: 'Failed to update group message' });
            }
        });

        socket.on('delete_message', async (data) => {
            try {
                if (!data.messageId) {
                    logger.error("Message ID is missing in delete_message request");
                    return socket.emit('error', { message: 'Message ID is required' });
                }
        
                const deletedMessage = await deleteMessage(io, data);
        
                const receiverSocketData = await SocketSchema.findOne({ user_id: deletedMessage.receiver_id });
                if (receiverSocketData) {
                    io.to(receiverSocketData.socket_id).emit('message_deleted', deletedMessage);
                }
        
                socket.emit('message_deleted', deletedMessage);
        
            } catch (err) {
                socket.emit('error', { message: 'Failed to delete message' });
                logger.error("Error deleting message", err);
            }
        });
        
        socket.on('delete_group_message', async (data) => {
            try {
                if (!data.messageId) {
                    logger.error("Message ID is missing in delete_group_message");
                    return socket.emit('error', { message: 'messageId is required' });
                }
        
                const result = await deleteGroupMessage(data, io);
                socket.emit("group_message_deleted", result);
        
            } catch (err) {
                socket.emit('error', { message: 'Failed to delete group message' });
                logger.error("Error deleting group message", err);
            }
        });
        
        socket.on('message_seen', async (data) => {
            const { messageId, user_id, isGroup = false} = data;

            const Model = isGroup ? GroupMessageSchema : MessageSchema;
        
            const message = await Model.findById(messageId);
            if (!message) {
                return socket.emit('error', { message: 'Message not found' });
            }
        
            // if (message.message_status !== 'seen') {
            if (message.message_status !== 'seen' && !message.is_read) { 
                await Model.findByIdAndUpdate(messageId, {  message_status: 'seen', is_read: true }, { new: true });
        
                // Notify sender that message has been seen
                const senderSocketData = await SocketSchema.findOne({ user_id: message.sender_id });
                if (senderSocketData) {
                    io.to(senderSocketData.socket_id).emit('message_seen', {
                        messageId,
                        message_status: 'seen',
                        is_read: true,
                        seen_by: user_id
                    });
                }

                 const unseenMessages = await Model.find({
            receiver_id: message.receiver_id,
            message_status: { $ne: MessageStatus.SEEN }
        });

        if (unseenMessages.length === 0 && emailTimers.has(message.receiver_id)) {
            clearTimeout(emailTimers.get(message.receiver_id));
            emailTimers.delete(message.receiver_id);
        }
            }
        });    
    })
};



const updateSocket = (socket, socketData) => {
    return new Promise(async (resolve, reject) => {
        try {
            await SocketSchema.updateOne(
                { user_id: socketData[0]['user_id'] },
                { $set: { socket_id: socket.id } }
            );
            logger.info(`Socket updated successfully for user id ${socketData[0]['user_id']} with socket id ${socket.id}`);
            resolve(true);
        } catch (err) {
            logger.error(messageConstants.INTERNAL_SERVER_ERROR, err);
            reject(err);
        }
    });
};

const createSocket = (data, socket) => {
    return new Promise(async (resolve, reject) => {
        try {
            data['socket_id'] = socket.id;
            const socketSchema = new SocketSchema(data);
            await socketSchema.save();
            logger.info(`Socket created successfully for user id ${data['user_id']} with socket id ${socket.id}`);
            resolve(true);
        } catch (err) {
            if (err.code === 11000) {
                logger.error(`${Object.keys(err.keyValue)} already exists`);
                resolve(false);
            } else {
                logger.error(messageConstants.INTERNAL_SERVER_ERROR, err);
                reject(err);
            }
        }
    });
};

const createMessage = async (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const messageSchema = new MessageSchema(data);
            await messageSchema.save().then(result => {
                logger.info(messageConstants.MESSAGE_SAVED_SUCCESS, result);
                return resolve(result);
            })
        } catch (err) {
            logger.error(messageConstants.MESSAGE_CREATION_FAILED, err);
            return reject(err);
        }
    })
}

const createGroupMessage = async (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const groupMessageSchema = new GroupMessageSchema(data);
            await groupMessageSchema.save().then(result => {
                logger.info(messageConstants.MESSAGE_SAVED_SUCCESS, result);
                return resolve(result);
            });
        } catch (err) {
            logger.error(messageConstants.MESSAGE_CREATION_FAILED, err);
            return reject(err);
        }
    });
};

const updateMessage = async (messageId, data) => {
    return new Promise(async (resolve, reject) => {
        try {

            const message = await MessageSchema.findById(messageId);

            if (!message) {
                logger.error("Message not found");
                return reject("Message not found");
            }

            // Check if message is a text message
            // if (message.message_type !== "text") {
            //     logger.error("Only text messages can be edited");
            //     return reject("Only text messages can be edited");
            // }

            // Check if message is within 15 minutes of sending
            // const timeElapsed = (Date.now() - new Date(message.created_at)) / 60000; // Convert to minutes
            // if (timeElapsed > 60) {
            //     logger.error("Message editing time expired");
            //     return reject("Message editing time expired");
            // }

            const updatedMessage = await MessageSchema.findByIdAndUpdate(
                messageId,
                // { $set: data },
                { $set: { message: data.message, edited: true } },
                { new: true } 
            );

            if (!updatedMessage) {
                logger.error(messageConstants.MESSAGE_NOT_FOUND);
                return reject(messageConstants.MESSAGE_NOT_FOUND);
            }

            logger.info(messageConstants.MESSAGE_UPDATED_SUCCESS, updatedMessage);
            return resolve(updatedMessage);
        } catch (err) {
            logger.error(messageConstants.MESSAGE_UPDATE_FAILED, err);
            return reject(err);
        }
    });
};

const updateGroupMessage = async (messageId, data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const message = await GroupMessageSchema.findById(messageId);

            if (!message) {
                logger.error("Group message not found");
                return reject("Group message not found");
            }

            // Check if message is a text message
            if (message.message_type !== "text") {
                logger.error("Only text messages can be edited");
                return reject("Only text messages can be edited");
            }

            // Check if message is within 15 minutes of sending
            const timeElapsed = (Date.now() - new Date(message.created_at)) / 60000;
            if (timeElapsed > 60) {
                logger.error("Message editing time expired");
                return reject("Message editing time expired");
            }

            const updatedMessage = await GroupMessageSchema.findByIdAndUpdate(
                messageId,
                // { $set: data },
                { $set: { message: data.message, edited: true } },
                { new: true }
            );

            if (!updatedMessage) {
                logger.error(messageConstants.MESSAGE_NOT_FOUND);
                return reject(messageConstants.MESSAGE_NOT_FOUND);
            }

            logger.info(messageConstants.MESSAGE_UPDATED_SUCCESS, updatedMessage);
            return resolve(updatedMessage);
        } catch (err) {
            logger.error(messageConstants.MESSAGE_UPDATE_FAILED, err);
            return reject(err);
        }
    });
};

const deleteMessage = async (io, data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { messageId } = data;

            if (!messageId) {
                logger.error("Message ID is missing");
                return reject("Message ID is required");
            }

            logger.info("Attempting to soft delete message with ID:", messageId);

            const message = await MessageSchema.findById(messageId);

            if (!message) {
                logger.error("Message not found");
                return reject("Message not found");
            }

            const timeElapsed = (Date.now() - new Date(message.created_at)) / 1000 /60; 

            if (timeElapsed > 180) {
                logger.error("Delete time expired");
                return reject("Delete time expired");
            }

            // Soft delete for all users
            await MessageSchema.findByIdAndUpdate(messageId, {
                is_deleted: true,
                updated_at: new Date()
            });

            logger.info("Message marked as deleted");

            // Notify sender and receiver
            const receiverSocket = await SocketSchema.findOne({ user_id: message.receiver_id });
            if (receiverSocket) {
                io.to(receiverSocket.socket_id).emit("message_deleted", { messageId, is_deleted: true });
            }

            return resolve({ messageId, is_deleted: true });

        } catch (err) {
            logger.error("Failed to delete message", err);
            return reject(err);
        }
    });
};


const deleteGroupMessage = async (data, io) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { messageId } = data;

            if (!mongoose.Types.ObjectId.isValid(messageId)) {
                logger.error("Invalid messageId format:", messageId);
                return reject("Invalid messageId format");
            }

            const message = await GroupMessageSchema.findById(messageId);

            if (!message) {
                logger.error("Group message not found");
                return reject("Group message not found");
            }

            const timeElapsed = (Date.now() - new Date(message.created_at)) / 1000 /60; 

            if (timeElapsed > 180) {
                logger.error("Group message delete time expired");
                return reject("Delete time expired");
            }

            await GroupMessageSchema.findByIdAndUpdate(messageId, {
                is_deleted: true,
                updated_at: new Date()
            });

            logger.info("Group message marked as deleted");

            io.to(message.room_id.toString()).emit("group_message_deleted", { messageId, is_deleted: true });

            return resolve({ messageId, is_deleted: true });

        } catch (err) {
            logger.error("Failed to delete group message", err);
            return reject(err);
        }
    });
};