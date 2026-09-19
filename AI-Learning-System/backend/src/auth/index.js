const router  = require('./routes');
const service = require('./service');
const session = require('./session');

module.exports = {
  router,
  service,
  // Re-exported guards for other modules to use
  requireLogin: session.requireLogin,
  requireAdmin: session.requireAdmin,
  attachUser:   session.attachUser,
};