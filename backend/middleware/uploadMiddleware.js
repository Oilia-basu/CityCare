// Multer (memory storage) with strict size + type validation for profile / department images.
const multer = require('multer');
const { AppError } = require('../utils/apiResponse');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new AppError('Only JPG, PNG or WEBP images are allowed.', 400))),
});

module.exports = { uploadImage: upload.single('image') };
