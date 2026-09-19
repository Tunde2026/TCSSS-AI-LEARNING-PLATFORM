// Ollama — the always-on local fallback.
// No API key needed; the Authorization header is set but ignored by Ollama.
// Longer timeout because local models are slower than cloud ones.

const config = require('../../core/config');

module.exports = {
  id: 'ollama',
  baseUrl: config.ollama.url,
  model: config.ollama.model,
  timeoutMs: 600000,   // 10 minutes — CPU inference is slow
    keys: ['ollama'], // placeholder so the gateway treats it like the others
};