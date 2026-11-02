// Authenticates the request from the HTTP-only JWT cookie (Authorization: Bearer is accepted as fallback for Postman).
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../utils/apiResponse');
const { COOKIE_NAME } = require('../utils/generateToken');

const protect = asyncHandler(async (req, _res, next) => {
  let token = req.cookies?.[COOKIE_NAME];
  const header = req.headers.authorization;
  if (!token && header?.startsWith('Bearer ')) token = header.split(' ')[1];
  if (!token) throw new AppError('Not authenticated. Please log in.', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Session expired. Please log in again.', 401);
  }
  const user = await User.findById(decoded.id);
  if (!user) throw new AppError('Account no longer exists.', 401);
  if (!user.isActive) throw new AppError('Your account has been deactivated. Contact the hospital.', 403);
  req.user = user;
  next();
});

module.exports = { protect };
