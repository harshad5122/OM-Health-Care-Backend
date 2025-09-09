
const { responseData, messageConstants, mailTemplateConstants, mailSubjectConstants } = require('../../constants');

const NotificationSchema = require('../../models/notification')

const getNotifications = async (req, res) => {
    return new Promise(async () => {
        try {
            const userDetails = req?.userDetails;
            console.log(userDetails, ">>LL")
            const notofications = await NotificationSchema?.find({
                receiver_id: userDetails?._id
            })

            return responseData.success(
                res,
                notofications,
                messageConstants.FETCHED_SUCCESSFULLY
            );
        } catch (error) {
            console.error("get notification error:", error);
            return responseData.fail(res, messageConstants.INTERNAL_SERVER_ERROR, 500);
        }
    })
}

module.exports = {
    getNotifications

}