const Notification = require('../models/Notification');
const { asyncHandler, sendSuccess, paginate, pageMeta, AppError } = require('../utils/apiResponse');

// GET /api/notifications?unread=true&page=&limit=
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate({ limit: 20, ...req.query });
  const filter = { recipient: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);
  sendSuccess(res, { items, unreadCount, meta: pageMeta(page, limit, total) });
});

exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { isRead: true }, { new: true });
  if (!n) throw new AppError('Notification not found', 404);
  sendSuccess(res, { notification: n });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
  sendSuccess(res, { updated: r.modifiedCount }, 'All notifications marked as read');
});

exports.remove = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  if (!n) throw new AppError('Notification not found', 404);
  sendSuccess(res, {}, 'Notification deleted');
});
