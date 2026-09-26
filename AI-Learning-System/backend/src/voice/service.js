// ============================================================
// voice/service.js
// ------------------------------------------------------------
// Provider-independent transcription.
//
// Fallback chain (see providers/index.js):
//   1. Deepgram (cloud, fastest)
//   2. OpenAI Whisper API (cloud, accurate)
//   3. Local Whisper CLI (developer laptop only)
// ============================================================

const logger = require('../core/logger');
const providers = require('./providers');

const MIN_BYTES = 1000;
const MAX_BYTES = 25 * 1024 * 1024;

async function transcribe(buffer, mimeType) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { ok: false, code: 'NO_AUDIO' };
  }
  if (buffer.length < MIN_BYTES) {
    return { ok: false, code: 'TOO_SHORT' };
  }
  if (buffer.length > MAX_BYTES) {
    return { ok: false, code: 'TOO_LARGE' };
  }

  const chain = providers.resolveChain();
  if (!chain.length) {
    return { ok: false, code: 'NO_PROVIDER' };
  }

  let lastError = null;
  for (const name of chain) {
    const provider = providers.getProvider(name);
    if (!provider) continue;

    const start = Date.now();
    try {
      const text = await provider.transcribe(buffer, mimeType);
      const trimmed = String(text || '').trim();

      if (!trimmed) {
        logger.warn('[voice] ' + name + ' returned empty transcript');
        lastError = 'EMPTY';
        continue;
      }

      logger.info('[voice] ' + name + ' ok in ' + (Date.now() - start) + 'ms — ' + trimmed.length + ' chars');
      return { ok: true, text: trimmed, provider: name };
    } catch (err) {
      lastError = err.message;
      logger.warn('[voice] ' + name + ' failed: ' + err.message);
    }
  }

  return { ok: false, code: 'ALL_PROVIDERS_FAILED', detail: lastError };
}

module.exports = { transcribe };