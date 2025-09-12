const  leaveServise = require('../../services/leave')

const createLeave = async (req, res) => {
    try {
        const response = await leaveServise?.createLeave(req, res)
        logger.info(`${messageConstants.RESPONSE_FROM} create leave`, JSON.stringify(response));
        res.send(response);

    } catch (err) {
        logger.error(`create leave ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

const getLeaveByDoctor = async (req,res) =>{
    try{
const response = await leaveServise?.getLeavesByProvider(req,res)
logger.info(`${messageConstants.RESPONSE_FROM} get leave`, JSON.stringify(response));
res.send(response);

    }catch(err){
        logger.error(`get leave ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}
const updateLeaveStatus = async (req,res) =>{
    try{
const response = await leaveServise?.updateLeaveStatus(req,res)
logger.info(`${messageConstants.RESPONSE_FROM} update leave`, JSON.stringify(response));
res.send(response);

    }catch(err){
        logger.error(`update leave ${messageConstants.API_FAILED}`, err);
        res.send(err);
    }
}

module.exports = {
    createLeave,
    getLeaveByDoctor,
    updateLeaveStatus
}