const { body } = require('express-validator');
const { isValidDate, isValidTime } = require('../utils/dateUtils');

exports.createAppointmentRules = [
  body('doctorId').isMongoId().withMessage('Select a valid doctor'),
  body('date').custom(isValidDate).withMessage('Date must be YYYY-MM-DD'),
  body('startTime').custom(isValidTime).withMessage('Time must be HH:mm'),
  body('reason').optional().isLength({ max: 500 }),
  body('symptoms').optional().isLength({ max: 1000 }),
  body('paymentMethod').optional().isIn(['Online', 'Cash']).withMessage('Payment method must be Online or Cash'),
];
exports.rescheduleRules = [
  body('date').custom(isValidDate).withMessage('Date must be YYYY-MM-DD'),
  body('startTime').custom(isValidTime).withMessage('Time must be HH:mm'),
];
exports.statusRules = [
  body('status').isIn(['Confirmed', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'Rejected', 'No-Show']).withMessage('Invalid status'),
];
