// ============================================================
// core/index.js
// ============================================================

const config   = require('./config');
const logger   = require('./logger');
const settings = require('./settings');
const audit    = require('./audit');
const authMw   = require('./middleware/auth');
const { errorHandler, wrap } = require('./middleware/errorHandler');
const { authLimiter, apiLimiter } = require('./middleware/rateLimit');

module.exports = {
  config,
  logger,
  settings,
  audit,

  requireLogin: authMw.requireLogin,
  requireAdmin: authMw.requireAdmin,

  errorHandler,
  wrap,
  authLimiter,
  apiLimiter,
};