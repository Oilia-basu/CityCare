// Audit logging. Never throws: a logging failure must not break the business operation.
const ActivityLog = require('../models/ActivityLog');

const logActivity = async (user, action, description, targetType, targetId) => {
  try {
    await ActivityLog.create({ user: user?._id || user, action, description, targetType, targetId: targetId ? String(targetId) : undefined });
  } catch (e) {
    console.error('Activity log failed:', e.message);
  }
};

module.exports = { logActivity };
