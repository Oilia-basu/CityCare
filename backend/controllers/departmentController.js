const Department = require('../models/Department');
const Doctor = require('../models/Doctor');
const { asyncHandler, sendSuccess, AppError } = require('../utils/apiResponse');
const { applyImage } = require('./_image');
const { logActivity } = require('../services/activityService');

// GET /api/departments  (public; admin may pass ?all=true to include inactive)
exports.list = asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const filter = isAdmin && req.query.all === 'true' ? {} : { isActive: true };
  const items = await Department.find(filter).sort({ name: 1 }).lean();
  const counts = await Doctor.aggregate([{ $group: { _id: '$department', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  sendSuccess(res, { items: items.map((d) => ({ ...d, doctorCount: map[String(d._id)] || 0 })) });
});

// POST /api/admin/departments
exports.create = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) throw new AppError('Department name is required', 400);
  const dep = new Department({ name: name.trim(), description });
  dep.image = (await applyImage(req.file)) || '';
  await dep.save();
  await logActivity(req.user, 'DEPARTMENT_CREATED', dep.name, 'Department', dep._id);
  sendSuccess(res, { department: dep }, 'Department created', 201);
});

// PUT /api/admin/departments/:id
exports.update = asyncHandler(async (req, res) => {
  const dep = await Department.findById(req.params.id);
  if (!dep) throw new AppError('Department not found', 404);
  if (req.body.name !== undefined) dep.name = req.body.name.trim();
  if (req.body.description !== undefined) dep.description = req.body.description;
  if (req.body.isActive !== undefined) dep.isActive = req.body.isActive === true || req.body.isActive === 'true';
  const img = await applyImage(req.file);
  if (img) dep.image = img;
  await dep.save();
  await logActivity(req.user, 'DEPARTMENT_UPDATED', dep.name, 'Department', dep._id);
  sendSuccess(res, { department: dep }, 'Department updated');
});

// DELETE /api/admin/departments/:id  (blocked while doctors are assigned)
exports.remove = asyncHandler(async (req, res) => {
  const dep = await Department.findById(req.params.id);
  if (!dep) throw new AppError('Department not found', 404);
  const n = await Doctor.countDocuments({ department: dep._id });
  if (n) throw new AppError(`${n} doctor(s) belong to this department. Reassign them first, or deactivate the department instead.`, 409);
  await dep.deleteOne();
  await logActivity(req.user, 'DEPARTMENT_DELETED', dep.name, 'Department', dep._id);
  sendSuccess(res, {}, 'Department deleted');
});
