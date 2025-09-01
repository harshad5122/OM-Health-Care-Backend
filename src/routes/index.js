const express = require('express');
const api = express.Router();

const routes = [
    `auth`,
    `message`,
    `upload_file`,
    `room`,
    `user`,
];

routes.forEach((route) => require(`./${route}`)(api));
// routes.forEach((route) => {
//     try {
//         console.log(`Loading route: ${route}`);
//         require(`./${route}`)(api);
//         console.log(`Successfully loaded: ${route}`);
//     } catch (error) {
//         console.error(`❌ ERROR loading route ${route}:`, error.message);
//         // Don't crash, continue loading other routes
//     }
// });

module.exports = api;
