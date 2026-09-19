// ============================================================
// ai/index.js
// ------------------------------------------------------------
// Public interface for the ai module.
// ============================================================

const gateway  = require('./gateway');
const router   = require('./routes');
const keyStore = require('./keyStore');

module.exports = {
  router,
  chat: gateway.chat,
  _debugState: gateway._debugState,
  keyStore,
};