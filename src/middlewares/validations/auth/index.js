const Joi = require('joi');
const { validateRequest } = require('../validate-request');

const signUpValidation = (req, res, next) => {
    const schema = Joi.object({
        firstname: Joi.string().required(),
        lastname: Joi.string().required(),
        phone: Joi.string().required(),
        role: Joi.number().required(),
    })
    validateRequest(req.body, res, schema, next)
}

const sendOtpValidation = (req, res, next) => {
    const schema = Joi.object({
        phone: Joi.string().required(),
    })
    validateRequest(req.body, res, schema, next)
}

module.exports = {
    signUpValidation,
    sendOtpValidation
}