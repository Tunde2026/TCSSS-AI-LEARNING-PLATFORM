const logger = require('../logger');

// Express error handler. Must be registered LAST in server.js.
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  logger.error(
    `[error] ${req.method} ${req.originalUrl} → ${status} :: ${err.message}`
  );

  // Never leak internal details in production.
  const message =
    process.env.NODE_ENV === 'production' && status >= 500
      ? 'Internal server error'
      : err.message;

  res.status(status).json({ error: message });
}

// Wrap async route handlers so thrown errors reach errorHandler.
// Usage:  router.get('/', wrap(async (req, res) => { ... }))
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, wrap };