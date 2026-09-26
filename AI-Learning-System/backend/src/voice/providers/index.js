// ============================================================
// voice/providers/index.js
// ------------------------------------------------------------
// Resolves the provider chain. Order:
//   1. VOICE_PROVIDER env var (explicit override)
//   2. Auto-detect: Deepgram → OpenAI → local Whisper
//
// The first configured provider is tried first. If it fails,
// the service falls through to the next one. That keeps voice
// working even if one cloud API is temporarily down.
// ============================================================

const logger = require('../../core/logger');

const REGISTRY = {
  deepgram: require('./deepgram'),
  openai:   require('./openai-whisper'),
  whisper:  require('./local-whisper'),
};

function isConfigured(name) {
  if (name === 'deepgram') return !!process.env.DEEPGRAM_API_KEY;
  if (name === 'openai')   return !!process.env.OPENAI_API_KEY;
  if (name === 'whisper')  return !!process.env.WHISPER_CMD;
  return false;
}

function resolveChain() {
  const forced = (process.env.VOICE_PROVIDER || '').trim().toLowerCase();

  if (forced && REGISTRY[forced]) {
    const rest = ['deepgram', 'openai', 'whisper'].filter(function (n) {
      return n !== forced && isConfigured(n);
    });
    return [forced].concat(rest);
  }

  const order = ['deepgram', 'openai', 'whisper'];
  const chain = order.filter(isConfigured);
  if (!chain.length) {
    logger.warn('[voice] no provider configured — set DEEPGRAM_API_KEY or OPENAI_API_KEY');
  }
  return chain;
}

function getProvider(name) {
  return REGISTRY[name] || null;
}

module.exports = { resolveChain, getProvider, REGISTRY };