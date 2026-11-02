// express-validator result handler + NoSQL-injection sanitizer.
const { validationResult } = require('express-validator');
const { AppError } = require('../utils/apiResponse');

const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new AppError(details[0].message, 400, details));
};

// Removes keys starting with "$" or containing "." from body/query/params (blocks operator injection).
const clean = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) delete obj[key];
    else clean(obj[key]);
  }
  return obj;
};
const sanitizeInput = (req, _res, next) => {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
};

module.exports = { validate, sanitizeInput };
