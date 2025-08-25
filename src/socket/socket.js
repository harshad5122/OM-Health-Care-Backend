// const { Server } = require('socket.io');
// const connectedUsers = new Map();

// let io = null;

// function setupSocket(server) {
//   io = new Server(server, {
//     cors: {
//       origin: '*',
//       methods: ['GET', 'POST'],
//     },
//   });

//   io.on('connection', (socket) => {
//     console.log(`Socket connected: ${socket.id}`);

//     socket.on('register', (userId) => {
//       connectedUsers.set(userId, socket.id);
//       console.log(`User ${userId} registered with socket ${socket.id}`);
//     });

//     socket.on('disconnect', () => {
//       for (const [uid, sid] of connectedUsers.entries()) {
//         if (sid === socket.id) {
//           connectedUsers.delete(uid);
//           console.log(`User ${uid} disconnected`);
//         }
//       }
//     });
//   });
// }

// function getIO() {
//   if (!io) throw new Error('Socket.io not initialized');
//   return io;
// }

// function getConnectedUsers() {
//   return connectedUsers;
// }

// module.exports = { setupSocket, getIO, getConnectedUsers };
