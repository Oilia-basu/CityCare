// Uploads an optional image file to Cloudinary and returns its URL (or undefined when no file).
const { uploadBuffer, isConfigured } = require('../config/cloudinary');
const { AppError } = require('../utils/apiResponse');

exports.applyImage = async (file, folder = 'hospital/departments') => {
  if (!file) return undefined;
  if (!isConfigured()) throw new AppError('Image uploads are not configured on the server (Cloudinary credentials missing).', 503);
  return (await uploadBuffer(file.buffer, folder)).secure_url;
};
