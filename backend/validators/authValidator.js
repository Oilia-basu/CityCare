const { body } = require('express-validator');

const passwordRule = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/[A-Za-z]/).withMessage('Password must contain a letter')
  .matches(/\d/).withMessage('Password must contain a number');

exports.registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('phone').trim().matches(/^[0-9+\-\s]{7,15}$/).withMessage('Enter a valid phone number'),
  passwordRule,
];
exports.loginRules = [
  body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];
exports.forgotRules = [body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail()];
exports.resetRules = [body('token').notEmpty().withMessage('Reset token is required'), passwordRule];
exports.changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Za-z]/).withMessage('New password must contain a letter')
    .matches(/\d/).withMessage('New password must contain a number'),
];
