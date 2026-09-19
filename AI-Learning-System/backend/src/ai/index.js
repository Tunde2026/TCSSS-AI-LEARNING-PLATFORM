// Public interface for the ai module.
// Everything outside this folder must go through this file.

const gateway = require('./gateway');
const router = require('./routes');

module.exports = {
  router,
  chat: gateway.chat,
  _debugState: gateway._debugState,
};