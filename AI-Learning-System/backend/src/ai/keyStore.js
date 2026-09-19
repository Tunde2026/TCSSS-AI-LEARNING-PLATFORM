// ============================================================
// ai/keyStore.js
// ------------------------------------------------------------
// Loads provider API keys from the database and applies them
// to the provider config objects at runtime.
//
// - AI providers: DB keys first, then .env fallbacks appended
// - Tavily: DB keys first, then .env fallback
//
// Gateway reads p.keys at call time, so no gateway changes needed.
// ============================================================

const db     = require('../db');
const logger = require('../core/logger');

const ENV_KEY_MAP = {
  groq:       ['GROQ_KEY_1', 'GROQ_KEY_2'],
  cerebras:   ['CEREBRAS_KEY_1'],
  google:     ['GOOGLE_KEY_1'],
  nvidia:     ['NVIDIA_KEY_1'],
  openrouter: ['OPENROUTER_KEY_1'],
};

const providers = [
  require('./providers/groq'),
  require('./providers/cerebras'),
  require('./providers/google'),
  require('./providers/nvidia'),
  require('./providers/openrouter'),
];

let lastLoaded = 0;
let tavilyKeys = [];   // [{ id, value }]

function envKeysFor(providerId) {
  return (ENV_KEY_MAP[providerId] || [])
    .map(k => process.env[k])
    .filter(Boolean);
}

async function loadAndApply() {
  try {
    const rows = await db.providerKeys.listEnabled();

    const byProvider = {};
    for (const r of rows) {
      if (!byProvider[r.provider]) byProvider[r.provider] = [];
      byProvider[r.provider].push({ id: r.id, value: r.key_value });
    }

    // AI providers — apply keys to config objects
    for (const p of providers) {
      const dbKeys  = (byProvider[p.id] || []).map(k => k.value);
      const envKeys = envKeysFor(p.id);
      p.keys = [...dbKeys, ...envKeys];
    }

    // Tavily — keep as objects with ids so we can log failures
    tavilyKeys = (byProvider.tavily || []).map(k => ({ id: k.id, value: k.value }));
    if (tavilyKeys.length === 0 && process.env.TAVILY_API_KEY) {
      tavilyKeys = [{ id: null, value: process.env.TAVILY_API_KEY }];
    }

    lastLoaded = Date.now();
    logger.debug(`[keyStore] applied keys (tavily: ${tavilyKeys.length})`);
  } catch (err) {
    logger.warn('[keyStore] load failed:', err.message);
  }
}

function getTavilyKeys() {
  return tavilyKeys.slice();
}

function isStale() {
  return Date.now() - lastLoaded > 60_000;
}

module.exports = { loadAndApply, getTavilyKeys, isStale };