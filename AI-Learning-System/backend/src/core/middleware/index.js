const { requireLogin, requireAdmin } = require('./auth');
const { rateLimit } = require('./rateLimit');
const { errorHandler } = require('./errorHandler');

module.exports = {
  requireLogin,
  requireAdmin,
  rateLimit,
  errorHandler
};
