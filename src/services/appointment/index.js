const { UserRole } = require('../../constants');
const { AppointmentStatus } = require('../../constants/enum');
const AppointmentSchema = require('../../models/appointment');
const { logger, mail } = require('../../utils');
const { responseData, messageConstants, mailTemplateConstants, mailSubjectConstants } = require('../../constants');

const createAppointment = async (req, res) => {
    return new Promise(async () => {
        try {
            const { patient_id, staff_id, date, time_slot, visit_type } = req?.body
            const userDetails = req.userDetails

            const payload = {
                patient_id,
                staff_id,
                date,
                time_slot,
                visit_type,
                created_by: userDetails?.role == UserRole.ADMIN ? "ADMIN" : "USER",
                status: AppointmentStatus?.PENDING
            }
            const appointment = await AppointmentSchema?.create({ ...payload })


            logger.info(
                "Appointment created successfully",
                { appointment: appointment?._id }
            );


            return responseData.success(
                res,
                appointment, // return both if you want
                messageConstants.DATA_SAVED_SUCCESSFULLY
            );
        } catch (error) {
            console.error(error);
            logger.error("Add Doctor " + messageConstants.INTERNAL_SERVER_ERROR, error);
            return responseData.fail(
                res,
                messageConstants.INTERNAL_SERVER_ERROR,
                500
            );
        }
    });
};

module.exports = {
    createAppointment
}