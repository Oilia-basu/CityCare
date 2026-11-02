// Returns the singleton settings document, creating it with defaults on first use.
const Settings = require('../models/Settings');

const getSettings = async () => {
  let s = await Settings.findOne({ key: 'main' });
  if (!s) s = await Settings.create({ key: 'main' });
  return s;
};

module.exports = { getSettings };
