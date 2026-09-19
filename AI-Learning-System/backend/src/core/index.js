const config   = require('./config');
const logger   = require('./logger');
const authMw   = require('./middleware/auth');
const { errorHandler, wrap } = require('./middleware/errorHandler');
const { authLimiter, apiLimiter } = require('./middleware/rateLimit');

module.exports = {
  config,
  logger,
  requireLogin: authMw.requireLogin,
  requireAdmin: authMw.requireAdmin,
  errorHandler,
  wrap,
  authLimiter,
  apiLimiter,
};