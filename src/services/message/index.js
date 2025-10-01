const MessageSchema = require('../../models/message');
const GroupMessageSchema = require('../../models/group_message');
const Broadcast = require("../../models/broadcast");
const User = require("../../models/user");
const RoomSchema = require('../../models/room')
const { responseData, messageConstants } = require('../../constants');
const { logger } = require('../../utils');
const { io } = require('../../index');
const { Types } = require('mongoose');


// const getMessageList = async (req, user, res) => {
//   return new Promise(async () => {
//     try {
//       let query = [];
//       const senderId = new Types.ObjectId(user._id);
//       const receiverId = req.query.user_id ? new Types.ObjectId(req.query.user_id) : null;

//       if (receiverId) {
//         // ✅ Pull both 1-to-1 and broadcast messages where user is included
//         query = [
//           {
//             $match: {
//               $and: [
//                 {
//                   $or: [
//                     // one-to-one messages
//                     { sender_id: senderId, receiver_id: receiverId },
//                     { sender_id: receiverId, receiver_id: senderId },
//                     // broadcast messages delivered to me
//                     { broadcast_id: { $exists: true } }
//                   ]
//                 },
//                 { is_deleted: false }
//               ]
//             }
//           },
//           {
//             $lookup: {
//               from: "broadcastdeliveries",
//               localField: "_id",   // message._id
//               foreignField: "message_id",
//               as: "deliveries"
//             }
//           },
//           {
//             $addFields: {
//               my_delivery: {
//                 $arrayElemAt: [
//                   {
//                     $filter: {
//                       input: "$deliveries",
//                       cond: { $eq: ["$$this.receiver_id", senderId] }
//                     }
//                   },
//                   0
//                 ]
//               }
//             }
//           },
//           {
//             $lookup: {
//               from: "users",
//               localField: "sender_id",
//               foreignField: "_id",
//               pipeline: [
//                 { $project: { _id: 1, firstname: 1, lastname: 1, email: 1 } }
//               ],
//               as: "sender_details",
//             },
//           },
//           {
//             $lookup: {
//               from: "users",
//               localField: "receiver_id",
//               foreignField: "_id",
//               pipeline: [
//                 { $project: { _id: 1, firstname: 1, lastname: 1, email: 1 } }
//               ],
//               as: "receiver_details",
//             },
//           },
//           {
//             $lookup: {
//               from: "messages",
//               let: { replyId: "$reply_to" },
//               pipeline: [
//                 { $match: { $expr: { $eq: ["$_id", "$$replyId"] } } },
//                 {
//                   $lookup: {
//                     from: "upload_files",
//                     localField: "attechment_id",
//                     foreignField: "_id",
//                     pipeline: [
//                       { $project: { _id: 1, name: 1, url: 1, size: 1 } }
//                     ],
//                     as: "attechment_details",
//                   }
//                 },
//                 {
//                   $project: {
//                     _id: 1,
//                     message: 1,
//                     message_type: 1,
//                     attechment_id: 1,
//                     attechment_details: 1,
//                     latitude: 1,
//                     longitude: 1,
//                     message_status: 1,
//                     created_at: 1,
//                   }
//                 }
//               ],
//               as: "reply_to_details"
//             }
//           },
//           { $unwind: { path: "$reply_to_details", preserveNullAndEmptyArrays: true } },
//           {
//             $lookup: {
//               from: "upload_files",
//               localField: "attechment_id",
//               foreignField: "_id",
//               pipeline: [
//                 { $project: { _id: 1, name: 1, url: 1, size: 1 } }
//               ],
//               as: "attechment_details",
//             },
//           },
//           { $sort: { created_at: -1 } }
//         ];
//       } else {
//         return responseData.fail(res, "Invalid parameters", 400);
//       }

//       const result = await MessageSchema.aggregate(query);

//       if (result.length > 0) {
//         return responseData.success(
//           res,
//           result,
//           `Message ${messageConstants.LIST_FETCHED_SUCCESSFULLY}`
//         );
//       } else {
//         return responseData.fail(
//           res,
//           `Message ${messageConstants.LIST_NOT_FOUND}`,
//           204
//         );
//       }
//     } catch (error) {
//       logger.error(messageConstants.INTERNAL_SERVER_ERROR, error);
//       return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
//     }
//   });
// };

const getMessageList = async (req, user, res) => {
  return new Promise(async () => {
    try {
      let query = [];

      const senderId = new Types.ObjectId(user._id);
      const receiverId = req.query.user_id ? new Types.ObjectId(req.query.user_id) : null;
      const broadcastId = req.query.broadcast_id ? new Types.ObjectId(req.query.broadcast_id) : null;
      if (receiverId) {
        query = [
          {
            $match: {
              $and: [
                {
                  $or: [
                    { sender_id: senderId, receiver_id: receiverId },
                    { sender_id: receiverId, receiver_id: senderId },
                    // broadcast messages delivered to me
                    // { broadcast_id: { $exists: true } }
                      // broadcast messages where user is recipient OR sender
              // { $and: [{ broadcast_id: { $exists: true } }, { sender_id: senderId }] },
              // { $and: [{ broadcast_id: { $exists: true } }, { "deliveries.receiver_id": senderId }] }
                  ]
                },
                { is_deleted: false }
              ]
            }
          },
    //       {
    //   $unionWith: {
    //     coll: "messages",
    //     pipeline: [
    //       { $match: { sender_id: senderId, broadcast_id: { $exists: true }, is_deleted: false } },
    //       {
    //         $lookup: {
    //           from: "broadcastdeliveries",
    //           let: { msgId: "$_id" },
    //           pipeline: [
    //             { $match: { $expr: { $and: [ { $eq: ["$message_id", "$$msgId"] }, { $eq: ["$receiver_id", receiverId] } ] } } }
    //           ],
    //           as: "delivery"
    //         }
    //       },
    //       { $match: { "delivery.0": { $exists: true } } }
    //     ]
    //   }
    // },
    {
      $unionWith: {
        coll: "messages",
        pipeline: [
          // 1️⃣ Only pick broadcast messages
          { $match: { broadcast_id: { $exists: true }, is_deleted: false } },

          // 2️⃣ Join with broadcast deliveries
          {
            $lookup: {
              from: "broadcastdeliveries",
              let: { msgId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$message_id", "$$msgId"] },
                        { $eq: ["$receiver_id", senderId] } // current user is recipient
                      ]
                    }
                  }
                }
              ],
              as: "delivery"
            }
          },

          // 3️⃣ Keep only messages that were delivered to me
          { $match: { "delivery.0": { $exists: true } } },

          // 4️⃣ Also keep only those from the other user (so it looks like a 1-1 chat)
          {
            $match: {
              sender_id: receiverId
            }
          }
        ]
      }
    },

         
          {
            $lookup: {
              from: "users",
              localField: "sender_id",
              foreignField: "_id",
              pipeline: [{ $project: { _id: 0, firstname: 1, lastname: 1, email: 1 } }],
              as: "sender_details",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "receiver_id",
              foreignField: "_id",
              pipeline: [{ $project: { _id: 0, firstname: 1, lastname: 1, email: 1 } }],
              as: "receiver_details",
            },
          },
          {
            $lookup: {  
              from: "messages",
              let: { replyId: "$reply_to" },
              pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$replyId"] } } },
                {
                  $lookup: {
                    from: "upload_files",
                    localField: "attechment_id",
                    foreignField: "_id",
                    pipeline: [{ $project: { _id: 0, name: 1, url: 1, size: 1 } }],
                    as: "attechment_details",
                  }
                },
                {
                  $project: {
                    _id: 0,
                    message: 1,
                    message_type: 1,
                    attechment_id: 1,
                    attechment_details: 1,
                    latitude: 1,
                    longitude: 1,
                    message_status: 1,
                    created_at: 1,
                  }
                }
              ],
              as: "reply_to_details"
            }
          },
          {
            $unwind: { path: "$reply_to_details", preserveNullAndEmptyArrays: true }
          },
          {
            $lookup: {
              from: "upload_files",
              localField: "attechment_id",
              foreignField: "_id",
              pipeline: [{ $project: { _id: 0, name: 1, url: 1, size: 1 } }],
              as: "attechment_details",
            },
          },
          { $sort: { created_at: -1 } }
        ];
      }
      else if (broadcastId) {
  query = [
    { $match: { broadcast_id: broadcastId, is_deleted: false } },
    {
      $lookup: {
        from: "broadcastdeliveries",
        localField: "_id",              // message._id
        foreignField: "message_id",
        as: "deliveries"
      }
    },
    {
      $addFields: {
        my_delivery: {
          $arrayElemAt: [
            {
              $filter: {
                input: "$deliveries",
                cond: { $eq: ["$$this.receiver_id", user._id] }
              }
            },
            0
          ]
        }
      }
    },
    { $sort: { created_at: -1 } }
  ];
}

      //  else if (broadcastId) {
      //   // Broadcast chat
      //   query = [
      //     {
      //       $match: {
      //         broadcast_id: broadcastId,
      //         is_deleted: false
      //       }
      //     },
      //     { $sort: { created_at: -1 } }
      //   ];
      // }
      else {
        return responseData.fail(res, "Invalid parameters", 400);
      }

      const result = await MessageSchema.aggregate(query);

      if (result.length > 0) {
        return responseData.success(res, result, `Message ${messageConstants.LIST_FETCHED_SUCCESSFULLY}`);
      } else {
        return responseData.fail(res, `Message ${messageConstants.LIST_NOT_FOUND}`, 204);
      }
    } catch (error) {
      logger.error(messageConstants.INTERNAL_SERVER_ERROR, error);
      return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
    }
  });
};

const getChatList = async (req, userDetails, res) => {
  return new Promise(async () => {
    try {
      const userId = userDetails?._id;

      // 1. Aggregate DM messages
      const dmMessages = await MessageSchema.aggregate([
        {
          $match: {
            $or: [
              { sender_id: userId },
              { receiver_id: userId },
            ],
            is_deleted: false
          }
        },
        { $sort: { created_at: -1 } },
        {
          $group: {
            _id: {
              $cond: [
                { $gt: ["$sender_id", "$receiver_id"] },
                { $concat: [{ $toString: "$receiver_id" }, "_", { $toString: "$sender_id" }] },
                { $concat: [{ $toString: "$sender_id" }, "_", { $toString: "$receiver_id" }] }
              ]
            },
            lastMessage: { $first: "$$ROOT" }
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "lastMessage.sender_id",
            foreignField: "_id",
            as: "sender"
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "lastMessage.receiver_id",
            foreignField: "_id",
            as: "receiver"
          }
        },
        {
          $addFields: {
            isRoom: false,

            senderName: {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: [{ $arrayElemAt: ["$sender.firstname", 0] }, ""] } }, 0] },
                {
                  $concat: [
                    { $ifNull: [{ $arrayElemAt: ["$sender.firstname", 0] }, ""] },
                    " ",
                    { $ifNull: [{ $arrayElemAt: ["$sender.lastname", 0] }, ""] }
                  ]
                },
                "Unknown"
              ]
            },

            receiverName: {
              $concat: [
                { $ifNull: [{ $arrayElemAt: ["$receiver.firstname", 0] }, ""] },
                " ",
                { $ifNull: [{ $arrayElemAt: ["$receiver.lastname", 0] }, ""] }
              ]
            },
            lastMessageText: { $ifNull: ["$lastMessage.message", ""] },

            senderId: "$lastMessage.sender_id",
            createdAt: "$lastMessage.created_at",
            email: {
              $cond: [
                { $eq: ["$lastMessage.sender_id", userId] },
                { $arrayElemAt: ["$receiver.email", 0] },
                { $arrayElemAt: ["$sender.email", 0] }
              ]
            },

            name: {
              $cond: [
                { $eq: ["$lastMessage.sender_id", userId] },
                {
                  $concat: [
                    { $ifNull: [{ $arrayElemAt: ["$receiver.firstname", 0] }, ""] },
                    " ",
                    { $ifNull: [{ $arrayElemAt: ["$receiver.lastname", 0] }, ""] }
                  ]
                },
                {
                  $concat: [
                    { $ifNull: [{ $arrayElemAt: ["$sender.firstname", 0] }, ""] },
                    " ",
                    { $ifNull: [{ $arrayElemAt: ["$sender.lastname", 0] }, ""] }
                  ]
                }
              ]
            },

            user_id: {
              $cond: [
                { $eq: ["$lastMessage.sender_id", userId] },
                { $toString: { $arrayElemAt: ["$receiver._id", 0] } },
                { $toString: { $arrayElemAt: ["$sender._id", 0] } }
              ]
            },

            // messageWithPrefix: {
            //   $ifNull: ["$lastMessage.message", ""]
            // }
            messageWithPrefix: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$lastMessage.message_type", "image"] },
                    then: "Photo"
                  },
                  {
                    case: { $eq: ["$lastMessage.message_type", "video"] },
                    then: "Video"
                  },
                  {
                    case: { $eq: ["$lastMessage.message_type", "location"] },
                    then: "Location"
                  },
                  {
                    case: { $eq: ["$lastMessage.message_type", "document"] },
                    then: {
                      $cond: [
                        { $gt: [{ $strLenCP: { $ifNull: ["$lastMessage.document_name", ""] } }, 0] },
                        "$lastMessage.document_name",
                        "Document"
                      ]
                    }
                  }
                ],
                default: { $ifNull: ["$lastMessage.message", ""] }
              }
            },
            // unread: {
            //   $cond: [
            //     { $eq: ["$lastMessage.message_status", "seen"] },
            //     false,
            //     true
            //   ]
            // }
            unread: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$lastMessage.message_status", "seen"] },
                    { $ne: ["$lastMessage.sender_id", userId] }  // Only receiver should see unread
                  ]
                },
                true,
                false
              ]
            }

          }
        },
        {
          $project: {
            _id: 0,
            isRoom: 1,
            name: 1,
            messageWithPrefix: 1,
            createdAt: 1,
            email: 1,
            user_id: 1,
            unread: 1,
          }
        },
      ]);

      const userRooms = await RoomSchema.find({ members: userId }).select('_id');
      const userRoomIds = userRooms.map(room => room._id);

      const userIdStr = userId.toString();

      const groupMessages = await RoomSchema.aggregate([
        {
          $match: {
            _id: { $in: userRoomIds }
          }
        },
        {
          $lookup: {
            from: "group_messages", // match your collection name
            let: { roomId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$room_id", "$$roomId"] }, is_deleted: false } },
              { $sort: { created_at: -1 } },
              { $limit: 1 }
            ],
            as: "lastMessage"
          }
        },
        {
          $unwind: {
            path: "$lastMessage",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "lastMessage.sender_id",
            foreignField: "_id",
            as: "sender"
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "creator"
          }
        },
        {
          $addFields: {
            senderName: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $arrayElemAt: ["$sender.firstname", 0] }, null] },
                    { $eq: [{ $arrayElemAt: ["$sender.firstname", 0] }, ""] }
                  ]
                },
                "Unknown",
                {
                  $concat: [
                    { $ifNull: [{ $arrayElemAt: ["$sender.firstname", 0] }, ""] },
                    " ",
                    { $ifNull: [{ $arrayElemAt: ["$sender.lastname", 0] }, ""] }
                  ]
                }
              ]
            },
            creatorName: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $arrayElemAt: ["$creator.firstname", 0] }, null] },
                    { $eq: [{ $arrayElemAt: ["$creator.firstname", 0] }, ""] }
                  ]
                },
                "Unknown",
                {
                  $concat: [
                    { $ifNull: [{ $arrayElemAt: ["$creator.firstname", 0] }, ""] },
                    " ",
                    { $ifNull: [{ $arrayElemAt: ["$creator.lastname", 0] }, ""] }
                  ]
                }
              ]
            },
            // unread: {
            //   $cond: [
            //     { $eq: ["$lastMessage.message_status", "seen"] },
            //     false,
            //     true
            //   ]
            // }
            unread: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$lastMessage.message_status", "seen"] },
                    { $ne: ["$lastMessage.sender_id", userId] }
                  ]
                },
                true,
                false
              ]
            }

          }
        },
        {
          $addFields: {
            isRoom: true,
            createdByString: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $type: "$user_id" }, "missing"] },
                    { $eq: [{ $type: "$user_id" }, "null"] }
                  ]
                },
                "MISSING",
                { $toString: "$user_id" }
              ]
            },


            // messageWithPrefix: {
            //   $cond: [
            //     { $gt: ["$lastMessage", null] }, // if message exists
            //     {
            //       $cond: [
            //         { $eq: ["$lastMessage.sender_id", userId] },
            //         { $concat: ["You: ", { $ifNull: ["$lastMessage.message", ""] }] },
            //         {
            //           $concat: [
            //             "$senderName",
            //             ": ",
            //             { $ifNull: ["$lastMessage.message", ""] }
            //           ]
            //         }
            //       ]
            //     },
            //     {
            //       $cond: [
            //         //{ $eq: ["$created_by", userId] },
            //         { $eq: [{ $toString: "$user_id" }, userIdStr] },
            //         "You created this group",
            //        // "User added you"
            //        { $concat: ["$creatorName", " added you"] }
            //       ]
            //     }
            //   ]
            // },
            messageWithPrefix: {
              $cond: [
                { $gt: ["$lastMessage", null] },
                {
                  $let: {
                    vars: {
                      content: {
                        $switch: {
                          branches: [
                            {
                              case: { $eq: ["$lastMessage.message_type", "image"] },
                              then: "Photo"
                            },
                            {
                              case: { $eq: ["$lastMessage.message_type", "video"] },
                              then: "Video"
                            },
                            {
                              case: { $eq: ["$lastMessage.message_type", "location"] },
                              then: "Location"
                            },
                            {
                              case: { $eq: ["$lastMessage.message_type", "document"] },
                              then: {
                                $cond: [
                                  { $gt: [{ $strLenCP: { $ifNull: ["$lastMessage.document_name", ""] } }, 0] },
                                  "$lastMessage.document_name",
                                  "Document"
                                ]
                              }
                            }
                          ],
                          default: { $ifNull: ["$lastMessage.message", ""] }
                        }
                      }
                    },
                    in: {
                      $cond: [
                        { $eq: ["$lastMessage.sender_id", userId] },
                        { $concat: ["You: ", "$$content"] },
                        { $concat: ["$senderName", ": ", "$$content"] }
                      ]
                    }
                  }
                },
                {
                  $cond: [
                    { $eq: [{ $toString: "$user_id" }, userIdStr] },
                    "You created this group",
                    { $concat: ["$creatorName", " added you"] }
                  ]
                }
              ]
            },

            createdAtSortable: {
              $cond: [
                { $gt: ["$lastMessage.created_at", null] },
                "$lastMessage.created_at",
                "$created_at"
              ]
            }
          }
        },
        {
          $project: {
            _id: 0,
            isRoom: 1,
            name: "$name",
            messageWithPrefix: 1,
            createdAt: "$createdAtSortable",
            room_id: { $toString: "$_id" },
            unread: 1,
          }
        },
        {
          $sort: { createdAt: -1 }
        }
      ]);

      const allChats = [...dmMessages, ...groupMessages];
      allChats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return res.json(allChats);
    } catch (error) {
      logger.error("INTERNAL_SERVER_ERROR", error);
      return responseData.fail(res, "INTERNAL_SERVER_ERROR", 500);
    }
  });
};


const getGroupMessageList = async (req, user, res) => {
  return new Promise(async () => {
    try {
      const roomId = req.query.room_id ? new Types.ObjectId(req.query.room_id) : null;

      if (!roomId) {
        return responseData.fail(res, "Missing room_id", 400);
      }

      const query = [
        { $match: { room_id: roomId, is_deleted: false } },
        {
          $lookup: {
            from: "users",
            localField: "sender_id",
            foreignField: "_id",
            pipeline: [
              { $project: { _id: 0, firstname: 1, lastname: 1, email: 1 } }
            ],
            as: "sender_details"
          }
        },
        {
          $lookup: {
            from: "upload_files",
            localField: "attechment_id",
            foreignField: "_id",
            pipeline: [
              { $project: { _id: 0, name: 1, url: 1, size: 1 } }
            ],
            as: "attechment_details"
          }
        },
        {
          $lookup: {
            from: "rooms",
            localField: "room_id",
            foreignField: "_id",
            pipeline: [
              { $project: { _id: 0, name: 1, members: 1 } }
            ],
            as: "room_details"
          }
        },
        {
          $lookup: {
            from: "group_messages",
            let: { replyId: "$reply_to" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$replyId"] } } },
              {
                $lookup: {
                  from: "upload_files",
                  localField: "attechment_id",
                  foreignField: "_id",
                  pipeline: [{ $project: { _id: 0, name: 1, url: 1, size: 1 } }],
                  as: "attechment_details",
                }
              },
              {
                $project: {
                  _id: 0,
                  message: 1,
                  message_type: 1,
                  attechment_id: 1,
                  attechment_details: 1,
                  latitude: 1,
                  longitude: 1,
                  message_status: 1,
                  created_at: 1,
                }
              }
            ],
            as: "reply_to_details"
          }
        },
        {
          $unwind: { path: "$reply_to_details", preserveNullAndEmptyArrays: true }
        },
        {
          $sort: { created_at: -1 }
        }
      ];

      const result = await GroupMessageSchema.aggregate(query);

      if (result.length > 0) {
        return responseData.success(res, result, "Group messages fetched successfully");
      } else {
        return responseData.fail(res, "No messages found for this group", 204);
      }
    } catch (error) {
      logger.error("INTERNAL_SERVER_ERROR", error);
      return responseData.fail(res, "Internal server error", 500);
    }
  });
};


const getBroadcastList = (req, userDetails, res) => {
  return new Promise(async (resolve) => {
    try {
      const userId = userDetails?._id;


      const broadcasts = await Broadcast.find({
        $or: [
          { createdBy: userId },
          { recipients: userId }
        ]
      })
        .select("title createdBy recipients createdAt")
        .lean();

      if (!broadcasts.length) {
        responseData.success(res, [], "No broadcasts found");
        return resolve();
      }

      const broadcastIds = broadcasts.map(b => b._id);

      const lastMessages = await MessageSchema.aggregate([
        { $match: { broadcast_id: { $in: broadcastIds }, is_deleted: false } },
        { $sort: { created_at: -1 } },
        { $group: { _id: "$broadcast_id", lastMessage: { $first: "$$ROOT" } } }
      ]);

      const lastMsgMap = {};
      lastMessages.forEach(lm => {
        lastMsgMap[lm._id.toString()] = lm.lastMessage;
      });

   
      const response = broadcasts.map(bc => {
        const lastMsg = lastMsgMap[bc._id.toString()];
        const prefixMessage = lastMsg ? `You: ${lastMsg.message || ""}` : "";

     
        const recipients = Array.isArray(bc.recipients)
          ? bc.recipients.map(r => (r._id ? r._id.toString() : r.toString()))
          : [];

        return {
          id: bc._id.toString(),
          title: bc.title,
          createdAt: lastMsg ? lastMsg.created_at : bc.createdAt,
          recipients,
          lastMessage: prefixMessage,
        };
      });

  
      response.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      
      responseData.success(res, response, "Broadcast list fetched successfully");
      resolve();

    } catch (error) {
      logger.error("Get broadcast list API failed", error);
      responseData.fail(res, "Failed to fetch broadcasts", 500);
      resolve();
    }
  });
};

const getBroadcastRecipients = (req, userDetails, res) => {
  return new Promise(async (resolve) => {
    try {
      const userId = userDetails?._id;
      const broadcastId = req.params.id;
      console.log("Received broadcastId:", broadcastId);

      // 1. Find the broadcast
      const broadcast = await Broadcast.findById(broadcastId)
        .populate("recipients", "_id firstname lastname email phone")
        .lean();

      if (!broadcast) {
        responseData.fail(res, "Broadcast not found", 404);
        return resolve();
      }

      // Check if user is creator or recipient
      if (
        broadcast.createdBy.toString() !== userId.toString() &&
        !broadcast.recipients.some(r => r._id.toString() === userId.toString())
      ) {
        responseData.fail(res, "Unauthorized to view recipients", 403);
        return resolve();
      }

      // 2. Format recipients
      const recipients = (broadcast.recipients || []).map(r => ({
        id: r._id.toString(),
        name: `${r.firstname || ""} ${r.lastname || ""}`.trim(),
        email: r.email,
        phone: r.phone
      }));

      responseData.success(res, recipients, "Recipients fetched successfully");
      resolve();

    } catch (error) {
      logger.error("Get broadcast recipients API failed", error);
      responseData.fail(res, "Failed to fetch recipients", 500);
      resolve();
    }
  });
};



module.exports = {
  // sendMessage,
  // getMessage,
  getMessageList,
  getChatList,
  getGroupMessageList,
  getBroadcastList,
  getBroadcastRecipients
};
