const messageService = require('../../services/message');
const { messageConstants } = require('../../constants');
const { logger } = require('../../utils');

// const sendMessage = async (req, res) => {
//     try {
//         const response = await messageService.sendMessage(req.body, req?.userDetails, res);
//         logger.info(`${messageConstants.RESPONSE_FROM} send message API`, JSON.stringify(response));
//         res.send(response);
//     } catch (err) {
//         logger.error(`Send message ${messageConstants.API_FAILED}`, err);
//         res.send(err);
//     }
// }

// const getMessage = async (req, res) => {
//     try {
//         const response = await messageService.getMessage(req.params, req?.userDetails, res);
//         logger.info(`${messageConstants.RESPONSE_FROM} get message API`, JSON.stringify(response));
//         res.send(response);
//     } catch (err) {
//         logger.error(`Get message ${messageConstants.API_FAILED}`, err);
//         res.send(err);
//     }
// }

const getMessageList = async (req, res) => {
    try {
        const response = await messageService.getMessageList(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get message list API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Message list ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const getChatList = async (req, res) => {
    try {
        const response = await messageService.getChatList(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get chat list API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Chat list ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const getGroupMessageList = async (req, res) => {
    try {
        const response = await messageService.getGroupMessageList(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get group message list API`, JSON.stringify(response));
        res.send(response);
    } catch (err) {
        logger.error(`Get Group Message list ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}


const getBroadcastList = async (req, res) => {
    try {
        const response = await messageService.getBroadcastList(req, req?.userDetails, res);
        logger.info(`${messageConstants.RESPONSE_FROM} get broadcast list API`, JSON.stringify(response));
        // res.send(response);
    } catch (err) {
        logger.error(`Get broadcast list ${messageConstants.API_FAILED}`, err);
        // res.send(err);
         if (!res.headersSent) {
            res.status(500).send({ msg: "An error occurred" });
        }
    }
}

const getBroadcastRecipients = async (req, res) => {
  try {
    const response = await messageService.getBroadcastRecipients(req, req?.userDetails, res);
    logger.info(`${messageConstants.RESPONSE_FROM} get broadcast recipients API`, JSON.stringify(response));
    res.send(response);
  } catch (err) {
    logger.error(`Get broadcast recipients ${messageConstants.API_FAILED}`, err);
    res.send(err);
  }
};



module.exports = {
    // sendMessage,
    // getMessage,
    getMessageList,
    getChatList,
    getGroupMessageList,
    getBroadcastList,
    getBroadcastRecipients
}