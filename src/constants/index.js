const messageConstants = require("./messages");
const responseData = require("./response");
const urlConstants = require("./url");
const {UserRole, UserTypes} = require('./enum')
const { mailSubjectConstants, mailTemplateConstants } = require('./mail');

module.exports = {
    messageConstants,
    urlConstants,
    responseData,
    UserRole,
    UserTypes,
    mailSubjectConstants,
    mailTemplateConstants,
}