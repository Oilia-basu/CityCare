const crypto = require('crypto');
const User = require('../models/User');
const { AppError, asyncHandler, sendSuccess } = require('../utils/apiResponse');
const { setAuthCookie, clearAuthCookie } = require('../utils/generateToken');
const { createPatientAccount, getProfile } = require('../services/profileService');
const { sendPasswordResetEmail } = require('../services/emailService');
const { logActivity } = require('../services/activityService');
const { notify } = require('../services/notificationService');

const userPayload = async (user) => ({ user, profile: await getProfile(user) });

// POST /api/auth/register  (patients only)
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  const { user } = await createPatientAccount({ name, email, phone, password, isVerified: true });
  setAuthCookie(res, user._id);
  await notify(user._id, { title: 'Welcome!', message: 'Your account is ready. You can now book appointments.', type: 'system' });
  await logActivity(user, 'REGISTER', `New patient ${email}`, 'User', user._id);
  sendSuccess(res, await userPayload(user), 'Registration successful', 201);
});

// POST /api/auth/login  { email, password, portal? }  portal restricts which role may use a given login page
exports.login = asyncHandler(async (req, res) => {
  const { email, password, portal } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new AppError('Invalid email or password', 401);
  if (!user.isActive) throw new AppError('Your account has been deactivated. Contact the hospital.', 403);
  if (portal && user.role !== portal) {
    throw new AppError(`This account is not a ${portal} account. Please use the ${user.role} login.`, 403);
  }
  setAuthCookie(res, user._id);
  await logActivity(user, 'LOGIN', `${user.role} login`, 'User', user._id);
  sendSuccess(res, await userPayload(user), 'Logged in');
});

// POST /api/auth/logout
exports.logout = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  sendSuccess(res, {}, 'Logged out');
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => sendSuccess(res, await userPayload(req.user)));

// POST /api/auth/forgot-password  (same response whether or not the email exists)
exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && user.isActive) {
    const raw = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    const link = `${(process.env.CLIENT_URL || '').split(',')[0]}/reset-password?token=${raw}`;
    await sendPasswordResetEmail(user, link);
    if (process.env.NODE_ENV !== 'production') console.log(`[dev] password reset link for ${user.email}: ${link}`);
  }
  sendSuccess(res, {}, 'If an account exists for that email, a reset link has been sent.');
});

// POST /api/auth/reset-password  { token, password }
exports.resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash('sha256').update(String(req.body.token)).digest('hex');
  const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpire: { $gt: new Date() } }).select('+resetPasswordToken +resetPasswordExpire');
  if (!user) throw new AppError('This reset link is invalid or has expired.', 400);
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  await logActivity(user, 'PASSWORD_RESET', 'Password reset via email link', 'User', user._id);
  sendSuccess(res, {}, 'Password updated. You can now log in.');
});

// PUT /api/auth/change-password
exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(req.body.currentPassword))) throw new AppError('Current password is incorrect', 400);
  if (req.body.currentPassword === req.body.newPassword) throw new AppError('Choose a new password different from the current one', 400);
  user.password = req.body.newPassword;
  await user.save();
  await logActivity(user, 'PASSWORD_CHANGED', 'Password changed', 'User', user._id);
  sendSuccess(res, {}, 'Password changed');
});

// PUT /api/auth/profile { name, phone }  - basic account details for receptionists/admins (patients/doctors use their own profile endpoints)
exports.updateAccount = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) { if (!String(name).trim()) throw new AppError('Name cannot be empty', 400); req.user.name = String(name).trim(); }
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  sendSuccess(res, { user: req.user }, 'Account updated');
});
