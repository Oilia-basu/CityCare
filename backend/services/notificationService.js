// Creates in-app notifications (stored in MongoDB). Never throws.
const Notification = require('../models/Notification');

const notify = async (recipient, { title, message, type = 'system', appointment }) => {
  try {
    if (!recipient) return null;
    return await Notification.create({ recipient: recipient._id || recipient, title, message, type, relatedAppointment: appointment?._id || appointment });
  } catch (e) {
    console.error('Notification failed:', e.message);
    return null;
  }
};

module.exports = { notify };
