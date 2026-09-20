const config = require('../../core/config');

module.exports = {
  id: 'ollama',
  baseUrl: config.ollama.url,
  model: config.ollama.model,
  timeoutMs: 600000,
  keys: ['ollama'],
};
