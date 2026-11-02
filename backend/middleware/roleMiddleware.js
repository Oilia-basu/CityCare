// Role-based authorization: authorize('admin', 'receptionist')
const { AppError } = require('../utils/apiResponse');

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError('Not authenticated.', 401));
  if (!roles.includes(req.user.role)) return next(new AppError('You do not have permission to perform this action.', 403));
  next();
};

module.exports = { authorize };
